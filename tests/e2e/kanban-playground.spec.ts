import { test, expect, type Page } from '@playwright/test'
import path from 'path'

import { launchWithExtension } from './utils/extension'

const log = (message: string, data?: unknown) => {
  if (data !== undefined) {
    console.log(`[kanban-e2e] ${message}`, data)
  } else {
    console.log(`[kanban-e2e] ${message}`)
  }
}

const attachPageLogging = (page: Page) => {
  page.on('console', (msg) => {
    log(`page:${msg.type()}`, msg.text())
  })
  page.on('pageerror', (err) => {
    log('pageerror', err.message)
  })
  page.on('requestfailed', (req) => {
    log('requestfailed', { url: req.url(), error: req.failure()?.errorText })
  })
}

const readKanbanLogs = async (page: Page) =>
  page.evaluate(() => (window as any).__kanbanLogs || [])

const readKanbanSnapshot = async (page: Page) =>
  page.evaluate(() => (window as any).__kanbanSnapshot?.() || [])

const readUiDebug = async (page: Page) =>
  page.evaluate(() => (window as any).__kanbanUiDebug || null)

const dumpKanbanState = async (page: Page, label: string) => {
  const logs = await readKanbanLogs(page)
  const snapshot = await readKanbanSnapshot(page)
  log(`${label}: logCount=${logs.length}`)
  if (logs.length) {
    log('recentLogs', logs.slice(-10))
  }
  if (snapshot.length) {
    log('snapshot', snapshot)
  }
}

const waitForKanbanEvent = async (
  page: Page,
  criteria: { event: string; path: string; method?: string },
  label: string
) => {
  try {
    await page.waitForFunction(
      (target) => {
        const logs = (window as any).__kanbanLogs || []
        return logs.some(
          (entry: any) =>
            entry.event === target.event &&
            entry.path === target.path &&
            (!target.method || entry.method === target.method)
        )
      },
      criteria,
      { timeout: 5000 }
    )
    log(`${label} observed`, criteria)
  } catch (error) {
    log(`${label} not observed`, String(error))
    await dumpKanbanState(page, `${label}-missing`)
  }
}

test.describe('Kanban playground smoke', () => {
  test('creates, edits, moves cards and imports a board', async () => {
    const extPath = path.resolve('build/chrome-mv3')
    const { context, page: basePage, optionsUrl } = await launchWithExtension(extPath, {
      seedConfig: {
        __tldw_first_run_complete: true,
        __tldw_allow_offline: true
      }
    })
    log('extension launched', { optionsUrl })

    await context.addInitScript(() => {
      const now = () => new Date().toISOString()
      const logEntries: Array<Record<string, any>> = []
      const pushLog = (entry: Record<string, any>) => {
        logEntries.push({ at: now(), ...entry })
      }
      let nextBoardId = 1
      let nextListId = 1
      let nextCardId = 1

      const makeBoard = (name) => ({
        id: nextBoardId++,
        uuid: `board-${nextBoardId - 1}`,
        name,
        description: null,
        user_id: 'user-1',
        client_id: 'client-1',
        archived: false,
        archived_at: null,
        activity_retention_days: null,
        created_at: now(),
        updated_at: now(),
        deleted: false,
        deleted_at: null,
        version: 1,
        metadata: null,
        lists: []
      })

      const makeList = (boardId, name, position) => ({
        id: nextListId++,
        uuid: `list-${nextListId - 1}`,
        name,
        board_id: boardId,
        client_id: 'client-1',
        position: position ?? 0,
        archived: false,
        archived_at: null,
        created_at: now(),
        updated_at: now(),
        deleted: false,
        deleted_at: null,
        version: 1,
        card_count: null,
        cards: []
      })

      const makeCard = (boardId, listId, title, position) => ({
        id: nextCardId++,
        uuid: `card-${nextCardId - 1}`,
        title,
        description: null,
        board_id: boardId,
        list_id: listId,
        client_id: 'client-1',
        position: position ?? 0,
        due_date: null,
        due_complete: false,
        start_date: null,
        priority: null,
        archived: false,
        archived_at: null,
        created_at: now(),
        updated_at: now(),
        deleted: false,
        deleted_at: null,
        version: 1,
        metadata: null
      })

      const boards = new Map()
      const snapshot = () =>
        Array.from(boards.values()).map((board) => ({
          id: board.id,
          name: board.name,
          listCount: board.lists.length,
          cardCount: board.lists.reduce(
            (sum, list) => sum + list.cards.length,
            0
          )
        }))

      const toBoardList = () => {
        const items = Array.from(boards.values()).map((board) => {
          const { lists, ...rest } = board
          return rest
        })
        return {
          boards: items,
          pagination: {
            total: items.length,
            limit: 100,
            offset: 0,
            has_more: false
          }
        }
      }

      const withTotals = (board) => {
        const total = board.lists.reduce(
          (sum, list) => sum + list.cards.length,
          0
        )
        return { ...board, total_cards: total }
      }

      const getBoardById = (id) => boards.get(id)

      const findCardLocation = (cardId) => {
        for (const board of boards.values()) {
          for (const list of board.lists) {
            const cardIndex = list.cards.findIndex((card) => card.id === cardId)
            if (cardIndex !== -1) {
              return { board, list, cardIndex }
            }
          }
        }
        return null
      }

      const updateCardFields = (card, updates) => {
        Object.keys(updates || {}).forEach((key) => {
          if (updates[key] !== undefined) {
            card[key] = updates[key]
          }
        })
        card.updated_at = now()
      }

      const handleRequest = (payload) => {
        const path = payload?.path || ''
        const method = (payload?.method || 'GET').toUpperCase()
        const body = payload?.body || null
        const [pathname] = path.split('?')

        if (pathname === '/api/v1/kanban/boards' && method === 'GET') {
          return toBoardList()
        }

        if (pathname === '/api/v1/kanban/boards' && method === 'POST') {
          const board = makeBoard(body?.name || 'Untitled')
          boards.set(board.id, board)
          return board
        }

        const boardMatch = pathname.match(/^\/api\/v1\/kanban\/boards\/(\d+)$/)
        if (boardMatch) {
          const boardId = Number(boardMatch[1])
          const board = getBoardById(boardId)
          if (!board) return null
          if (method === 'GET') {
            return withTotals(board)
          }
          if (method === 'PATCH') {
            if (body?.name) {
              board.name = body.name
            }
            if (body?.description !== undefined) {
              board.description = body.description
            }
            board.updated_at = now()
            board.version += 1
            return board
          }
          if (method === 'DELETE') {
            boards.delete(boardId)
            return {}
          }
        }

        const listCreateMatch = pathname.match(
          /^\/api\/v1\/kanban\/boards\/(\d+)\/lists$/
        )
        if (listCreateMatch && method === 'POST') {
          const boardId = Number(listCreateMatch[1])
          const board = getBoardById(boardId)
          if (!board) return null
          const list = makeList(boardId, body?.name || 'Untitled', board.lists.length)
          board.lists.push(list)
          return list
        }

        const listReorderMatch = pathname.match(
          /^\/api\/v1\/kanban\/boards\/(\d+)\/lists\/reorder$/
        )
        if (listReorderMatch && method === 'POST') {
          return { success: true }
        }

        const cardCreateMatch = pathname.match(
          /^\/api\/v1\/kanban\/lists\/(\d+)\/cards$/
        )
        if (cardCreateMatch && method === 'POST') {
          const listId = Number(cardCreateMatch[1])
          const board = Array.from(boards.values()).find((b) =>
            b.lists.some((l) => l.id === listId)
          )
          if (!board) return null
          const list = board.lists.find((l) => l.id === listId)
          if (!list) return null
          const card = makeCard(board.id, listId, body?.title || 'Untitled', list.cards.length)
          list.cards.push(card)
          return card
        }

        const cardUpdateMatch = pathname.match(
          /^\/api\/v1\/kanban\/cards\/(\d+)$/
        )
        if (cardUpdateMatch && method === 'PATCH') {
          const cardId = Number(cardUpdateMatch[1])
          const location = findCardLocation(cardId)
          if (!location) return null
          updateCardFields(location.list.cards[location.cardIndex], body || {})
          return location.list.cards[location.cardIndex]
        }

        const cardMoveMatch = pathname.match(
          /^\/api\/v1\/kanban\/cards\/(\d+)\/move$/
        )
        if (cardMoveMatch && method === 'POST') {
          const cardId = Number(cardMoveMatch[1])
          const targetListId = Number(body?.target_list_id)
          const position = body?.position
          const location = findCardLocation(cardId)
          if (!location) return null
          const { cardIndex, list: sourceList, board } = location
          const [card] = sourceList.cards.splice(cardIndex, 1)
          const targetList = board.lists.find((list) => list.id === targetListId)
          if (!targetList) return null
          const insertAt =
            typeof position === 'number' && position >= 0
              ? Math.min(position, targetList.cards.length)
              : targetList.cards.length
          targetList.cards.splice(insertAt, 0, card)
          card.list_id = targetListId
          card.position = insertAt
          card.updated_at = now()
          return card
        }

        const cardReorderMatch = pathname.match(
          /^\/api\/v1\/kanban\/lists\/(\d+)\/cards\/reorder$/
        )
        if (cardReorderMatch && method === 'POST') {
          return { success: true }
        }

        if (pathname === '/api/v1/kanban/boards/import' && method === 'POST') {
          const importData = body?.data || {}
          const boardName =
            body?.board_name ||
            importData?.board?.name ||
            importData?.name ||
            'Imported Board'
          const board = makeBoard(boardName)
          boards.set(board.id, board)

          let listsImported = 0
          let cardsImported = 0

          const lists = Array.isArray(importData?.lists) ? importData.lists : []
          for (const listEntry of lists) {
            const list = makeList(
              board.id,
              listEntry?.name || `List ${listsImported + 1}`,
              board.lists.length
            )
            board.lists.push(list)
            listsImported += 1

            const cards = Array.isArray(listEntry?.cards) ? listEntry.cards : []
            for (const cardEntry of cards) {
              const card = makeCard(
                board.id,
                list.id,
                cardEntry?.title || 'Card',
                list.cards.length
              )
              list.cards.push(card)
              cardsImported += 1
            }
          }

          return {
            board,
            import_stats: {
              board_id: board.id,
              lists_imported: listsImported,
              cards_imported: cardsImported,
              labels_imported: 0,
              checklists_imported: 0,
              checklist_items_imported: 0,
              comments_imported: 0
            }
          }
        }

        return {}
      }

      const patchRuntime = (runtime) => {
        if (!runtime?.sendMessage) return
        const original = runtime.sendMessage.bind(runtime)
        const handler = (message, options, callback) => {
          const cb = typeof options === 'function' ? options : callback
          const respond = (payload) => {
            if (cb) {
              cb(payload)
              return undefined
            }
            return Promise.resolve(payload)
          }

          if (message?.type === 'tldw:request') {
            const payload = message.payload || {}
            const method = (payload?.method || 'GET').toUpperCase()
            const path = payload?.path || ''
            pushLog({ event: 'request', path, method, body: payload?.body || null })
            try {
              const data = handleRequest(payload)
              if (data == null) {
                pushLog({ event: 'response', path, method, status: 404 })
                return respond({ ok: false, status: 404, error: 'Not found' })
              }
              pushLog({ event: 'response', path, method, status: 200 })
              return respond({ ok: true, status: 200, data })
            } catch (error) {
              pushLog({
                event: 'response',
                path,
                method,
                status: 500,
                error: String(error || '')
              })
              return respond({ ok: false, status: 500, error: String(error || '') })
            }
          }
          if (original) {
            return original(message, options, callback)
          }
          return respond({ ok: true, status: 200, data: {} })
        }
        try {
          runtime.sendMessage = handler
          return
        } catch {}
        try {
          Object.defineProperty(runtime, 'sendMessage', {
            value: handler,
            configurable: true,
            writable: true
          })
        } catch {}
      }

      if (window.chrome?.runtime) {
        patchRuntime(window.chrome.runtime)
      }

      if (window.browser?.runtime) {
        patchRuntime(window.browser.runtime)
      }

      ;(window as any).__kanbanLogs = logEntries
      ;(window as any).__kanbanSnapshot = snapshot
      window.__kanbanStubbed = true
    })

    const page = await context.newPage()
    attachPageLogging(page)
    log('navigate to kanban page')
    await page.goto(optionsUrl + '?e2e=1#/kanban', { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => window.__kanbanStubbed === true)
    log('stub ready')
    const runtimeInfo = await page.evaluate(() => ({
      href: window.location.href,
      search: window.location.search,
      hasBrowser: Boolean(window.browser),
      hasChrome: Boolean(window.chrome),
      browserIsChrome: window.browser === window.chrome,
      browserRuntimeId: window.browser?.runtime?.id ?? null,
      chromeRuntimeId: window.chrome?.runtime?.id ?? null
    }))
    log('runtime info', runtimeInfo)
    await basePage.close().catch(() => {})
    await dumpKanbanState(page, 'after-navigation')
    log('ui debug after navigation', await readUiDebug(page))
    await expect(page.getByRole('heading', { name: 'Kanban Playground' })).toBeVisible()

    log('open create board modal')
    await page.getByRole('button', { name: 'New Board' }).click()
    const createDialog = page.getByRole('dialog', { name: /Create New Board/i })
    await expect(createDialog).toBeVisible()
    await createDialog.getByPlaceholder('Enter board name').fill('My Board')
    await createDialog.getByRole('button', { name: 'Create' }).click()
    await waitForKanbanEvent(
      page,
      { event: 'request', path: '/api/v1/kanban/boards', method: 'POST' },
      'create-board-request'
    )
    await waitForKanbanEvent(
      page,
      { event: 'response', path: '/api/v1/kanban/boards', method: 'POST' },
      'create-board-response'
    )
    await dumpKanbanState(page, 'after-create-click')
    const snapshotAfterCreate = await readKanbanSnapshot(page)
    const createdBoardId = snapshotAfterCreate?.[0]?.id
    log('created board id', createdBoardId)
    log('ui debug after create', await readUiDebug(page))
    if (createdBoardId) {
      await waitForKanbanEvent(
        page,
        {
          event: 'request',
          path: `/api/v1/kanban/boards/${createdBoardId}`,
          method: 'GET'
        },
        'get-board-request'
      )
    }
    const selectedBoardLabel = await page
      .locator('.ant-select-selection-item')
      .first()
      .textContent()
      .catch(() => null)
    log('selected board label', selectedBoardLabel)
    const emptyStateVisible = await page
      .getByText('Select a board or create a new one')
      .isVisible()
      .catch(() => false)
    log('empty state visible', emptyStateVisible)

    await expect(page.getByRole('heading', { name: 'My Board' })).toBeVisible()

    log('rename board')
    await page.getByRole('button', { name: 'Rename board' }).click()
    const renameDialog = page.getByRole('dialog', { name: /Rename Board/i })
    await expect(renameDialog).toBeVisible()
    await renameDialog.getByPlaceholder('Enter board name').fill('My Renamed Board')
    await renameDialog.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByRole('heading', { name: 'My Renamed Board' })).toBeVisible()

    log('add list Todo')
    await page.getByRole('button', { name: 'Add List' }).click()
    await page.getByPlaceholder('Enter list name').fill('Todo')
    await page.getByRole('button', { name: 'Add List' }).click()

    log('add list Doing')
    await page.getByRole('button', { name: 'Add List' }).click()
    await page.getByPlaceholder('Enter list name').fill('Doing')
    await page.getByRole('button', { name: 'Add List' }).click()

    const todoList = page.locator('.kanban-list').filter({ hasText: 'Todo' })
    log('add card Card A')
    await todoList.getByRole('button', { name: /Add card/i }).click()
    await todoList.getByPlaceholder('Enter card title').fill('Card A')
    await todoList.getByRole('button', { name: 'Add' }).click()

    await expect(todoList.getByText('Card A')).toBeVisible()

    log('edit card Card A')
    await todoList.getByText('Card A').click()
    const drawer = page.locator('.ant-drawer-content')
    await expect(drawer.getByText('Edit Card')).toBeVisible()

    await drawer.getByPlaceholder('Add a description...').fill('Test description')

    const prioritySection = drawer.locator('label:has-text("Priority")').locator('..')
    await prioritySection.locator('.ant-select-selector').click()
    await page.locator('.ant-select-item-option').filter({ hasText: 'High' }).click()

    await drawer.getByRole('button', { name: 'Save Changes' }).click()
    await drawer.getByRole('button', { name: 'Cancel' }).click()

    log('clear description/priority')
    await todoList.getByText('Card A').click()
    await expect(drawer.getByText('Edit Card')).toBeVisible()
    await drawer.getByPlaceholder('Add a description...').fill('')
    await prioritySection.locator('.ant-select-clear').click()
    await drawer.getByRole('button', { name: 'Save Changes' }).click()

    log('move card to Doing')
    const moveRow = drawer.getByRole('button', { name: 'Move' }).locator('..')
    const moveSelect = moveRow.locator('.ant-select-selector')
    await moveSelect.click()
    const moveDropdown = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
    await expect(moveDropdown).toBeVisible()
    const moveOption = moveDropdown.getByRole('option', { name: 'Doing' })
    await expect(moveOption).toBeVisible()
    await moveOption.click()
    await expect(drawer.getByRole('button', { name: 'Move' })).toBeEnabled()
    await drawer.getByRole('button', { name: 'Move' }).click()
    await waitForKanbanEvent(
      page,
      {
        event: 'request',
        path: '/api/v1/kanban/cards/1/move',
        method: 'POST'
      },
      'move-card-request'
    )
    await drawer.getByRole('button', { name: 'Cancel' }).click()

    const doingList = page.locator('.kanban-list').filter({ hasText: 'Doing' })
    await expect(doingList.getByText('Card A')).toBeVisible()

    log('import board')
    await page.getByRole('tab', { name: /Import/i }).click()

    const importPayload = {
      format: 'tldw_kanban_v1',
      board: { name: 'Imported Board', description: 'From test' },
      lists: [
        { name: 'Imported List', cards: [{ title: 'Imported Card' }] }
      ],
      labels: []
    }

    await page.setInputFiles('input[type="file"]', {
      name: 'kanban-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importPayload))
    })

    await expect(page.getByText('File Preview')).toBeVisible()
    await page.getByRole('button', { name: 'Import Board' }).click()
    await expect(page.getByRole('heading', { name: 'Imported Board' })).toBeVisible()

    await context.close()
  })
})
