import React from 'react'
import { Alert, Button, Form, Input, Segmented, Space, Spin, Tag } from 'antd'
import { useTranslation } from 'react-i18next'
import { tldwClient, TldwConfig } from '@/services/tldw/TldwApiClient'
import { tldwAuth } from '@/services/tldw/TldwAuth'

type Props = {
  onFinish?: () => void
}

export const OnboardingWizard: React.FC<Props> = ({ onFinish }) => {
  const { t } = useTranslation(['settings', 'common'])
  const [step, setStep] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [testing, setTesting] = React.useState(false)
  const [serverUrl, setServerUrl] = React.useState('')
  const [serverTouched, setServerTouched] = React.useState(false)
  const [authMode, setAuthMode] = React.useState<'single-user'|'multi-user'>('single-user')
  const [apiKey, setApiKey] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [connected, setConnected] = React.useState<boolean|null>(null)
  const [ragHealthy, setRagHealthy] = React.useState<'unknown'|'healthy'|'unhealthy'>('unknown')
  const [errorDetail, setErrorDetail] = React.useState<string>('')
  const [reachability, setReachability] = React.useState<'idle' | 'checking' | 'reachable' | 'unreachable'>('idle')
  const reachabilityAbortRef = React.useRef<AbortController | null>(null)
  const reachabilityDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  React.useEffect(() => {
    (async () => {
      try {
        const cfg = await tldwClient.getConfig()
        if (cfg?.serverUrl) {
          setServerUrl(cfg.serverUrl)
          setServerTouched(true)
        }
        if ((cfg as any)?.authMode) setAuthMode((cfg as any).authMode)
      } catch {}
    })()
  }, [])

  const urlState = React.useMemo(() => {
    const trimmed = serverUrl.trim()
    if (!trimmed) {
      return { valid: false, reason: 'empty' as const }
    }
    try {
      const parsed = new URL(trimmed)
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return { valid: false, reason: 'protocol' as const }
      }
      return { valid: true, reason: 'ok' as const }
    } catch {
      return { valid: false, reason: 'invalid' as const }
    }
  }, [serverUrl])

  const savePartial = async () => {
    const cfg: Partial<TldwConfig> = { serverUrl, authMode }
    if (authMode === 'single-user') cfg.apiKey = apiKey
    await tldwClient.updateConfig(cfg)
  }

  React.useEffect(() => {
    const trimmed = serverUrl.trim()

    if (!urlState.valid || !serverTouched || !trimmed) {
      setReachability('idle')
      if (reachabilityDebounceRef.current) {
        clearTimeout(reachabilityDebounceRef.current)
        reachabilityDebounceRef.current = null
      }
      if (reachabilityAbortRef.current) {
        reachabilityAbortRef.current.abort()
        reachabilityAbortRef.current = null
      }
      return
    }

    if (reachabilityDebounceRef.current) {
      clearTimeout(reachabilityDebounceRef.current)
      reachabilityDebounceRef.current = null
    }
    if (reachabilityAbortRef.current) {
      reachabilityAbortRef.current.abort()
      reachabilityAbortRef.current = null
    }

    setReachability('checking')

    reachabilityDebounceRef.current = setTimeout(() => {
      const controller = new AbortController()
      reachabilityAbortRef.current = controller
      const normalized = trimmed.replace(/\/$/, '')
      const target = `${normalized}/api/v1/health`

      fetch(target, { signal: controller.signal, credentials: 'include' })
        .then((res) => {
          if (controller.signal.aborted) return
          if (res.ok || res.status === 401 || res.status === 403) {
            setReachability('reachable')
          } else {
            setReachability('unreachable')
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setReachability('unreachable')
          }
        })
        .finally(() => {
          if (reachabilityAbortRef.current === controller) {
            reachabilityAbortRef.current = null
          }
        })
    }, 400)

    return () => {
      if (reachabilityDebounceRef.current) {
        clearTimeout(reachabilityDebounceRef.current)
        reachabilityDebounceRef.current = null
      }
    }
  }, [serverUrl, serverTouched, urlState])

  React.useEffect(() => {
    return () => {
      if (reachabilityDebounceRef.current) {
        clearTimeout(reachabilityDebounceRef.current)
      }
      if (reachabilityAbortRef.current) {
        reachabilityAbortRef.current.abort()
        reachabilityAbortRef.current = null
      }
    }
  }, [])

  const doTest = async () => {
    setTesting(true)
    setErrorDetail('')
    setConnected(null)
    try {
      await tldwClient.updateConfig({ serverUrl, authMode, apiKey: authMode==='single-user' ? apiKey : undefined })
      await tldwClient.initialize()
      const ok = await tldwClient.healthCheck()
      setConnected(!!ok)
      try {
        const rag = await tldwClient.ragHealth()
        setRagHealthy('healthy')
      } catch {
        setRagHealthy('unhealthy')
      }
    } catch (e: any) {
      setConnected(false)
      const msg = e?.message || 'Connection failed. Please check your server URL and credentials.'
      setErrorDetail(msg)
    } finally {
      setTesting(false)
    }
  }

  const next = async () => {
    if (step === 1) {
      await savePartial()
      setStep(2)
    } else if (step === 2) {
      setLoading(true)
      try {
        if (authMode === 'multi-user' && username && password) {
          await tldwAuth.login({ username, password })
        }
        await doTest()
        setStep(3)
      } catch (e: any) {
        setErrorDetail(e?.message || 'Login failed')
      } finally {
        setLoading(false)
      }
    }
  }

  const finish = async () => {
    try {
      await savePartial()
    } catch {}
    onFinish?.()
  }

  const serverHint = React.useMemo(() => {
    if (!urlState.valid) {
      const tone = urlState.reason === 'empty' ? 'neutral' : 'error'
      const message = urlState.reason === 'empty'
        ? t(
            'settings:onboarding.serverUrl.emptyHint',
            'Enter your tldw server URL to enable Next.'
          )
        : urlState.reason === 'protocol'
        ? t(
            'settings:onboarding.serverUrl.invalidProtocol',
            'Use http or https URLs, for example http://127.0.0.1:8000.'
          )
        : t(
            'settings:onboarding.serverUrl.invalid',
            'Enter a full URL such as http://127.0.0.1:8000.'
          )
      return { valid: false, tone, message }
    }

    let tone: 'neutral' | 'success' | 'error' = 'neutral'
    let message: string

    if (!serverTouched || reachability === 'idle') {
      tone = 'neutral'
      message = t(
        'settings:onboarding.serverUrl.ready',
        'We’ll enable Next once we can reach this address.'
      )
    } else if (reachability === 'checking') {
      tone = 'neutral'
      message = t(
        'settings:onboarding.serverUrl.checking',
        'Checking reachability…'
      )
    } else if (reachability === 'reachable') {
      tone = 'success'
      message = t(
        'settings:onboarding.serverUrl.reachable',
        'Server responded successfully. You can continue.'
      )
    } else {
      tone = 'error'
      message = t(
        'settings:onboarding.serverUrl.unreachable',
        'We couldn’t reach this address yet. Double-check the URL or try again.'
      )
    }

    return { valid: true, tone, message }
  }, [urlState, reachability, serverTouched, t])

  return (
    <div className="mx-auto w-full max-w-2xl rounded-xl border border-gray-200 bg-white px-6 py-6 text-gray-900 shadow-sm dark:border-gray-700 dark:bg-[#171717] dark:text-gray-100">
      <h2 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">{t('settings:onboarding.title')}</h2>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-4">{t('settings:onboarding.description')}</p>

      {step === 1 && (
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-800 dark:text-gray-100">{t('settings:onboarding.serverUrl.label')}</label>
          <Input
            placeholder={t('settings:onboarding.serverUrl.placeholder')}
            value={serverUrl}
            onChange={(e) => {
              if (!serverTouched) setServerTouched(true)
              setServerUrl(e.target.value)
            }}
            onBlur={() => setServerTouched(true)}
            status={serverHint.tone === 'error' && serverTouched ? 'error' : ''}
          />
          <div
            className={
              'text-xs ' +
              (serverHint.tone === 'error'
                ? 'text-red-500'
                : serverHint.tone === 'success'
                ? 'text-emerald-600'
                : 'text-gray-500')
            }
          >
            <span className="inline-flex items-center gap-2">
              {serverHint.message}
              {reachability === 'checking' && <Spin size="small" />}
            </span>
          </div>
          <div className="text-xs text-gray-500">{t('settings:onboarding.serverUrl.help')}</div>
          {connected === false && errorDetail && (
            <Alert
              className="mt-2"
              type="warning"
              showIcon
              message={t('settings:onboarding.connectionFailed')}
              description={errorDetail}
            />
          )}
          <div className="flex justify-end mt-2">
            <Button
              type="primary"
              disabled={!urlState.valid || reachability !== 'reachable'}
              onClick={next}
            >
              {t('settings:onboarding.buttons.next')}
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-800 dark:text-gray-100">{t('settings:onboarding.authMode.label')}</label>
            <Segmented
              options={[{ label: t('settings:onboarding.authMode.single'), value: 'single-user' }, { label: t('settings:onboarding.authMode.multi'), value: 'multi-user' }]}
              value={authMode}
              onChange={(v) => setAuthMode(v as any)}
            />
          </div>
          {authMode === 'single-user' ? (
            <div>
              <label className="block text-sm font-medium text-gray-800 dark:text-gray-100">{t('settings:onboarding.apiKey.label')}</label>
              <Input.Password placeholder={t('settings:onboarding.apiKey.placeholder')} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-100">{t('settings:onboarding.username.label')}</label>
                <Input placeholder={t('settings:onboarding.username.placeholder')} value={username} onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-800 dark:text-gray-100">{t('settings:onboarding.password.label')}</label>
                <Input.Password placeholder={t('settings:onboarding.password.placeholder')} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            </div>
          )}
          <div className="flex justify-between">
            <Button onClick={() => setStep(1)}>{t('settings:onboarding.buttons.back')}</Button>
            <Button type="primary" onClick={next} loading={loading}>{t('settings:onboarding.buttons.continue')}</Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{t('settings:onboarding.connection.label')}</span>
            {connected === null ? (
              <Tag>{t('settings:onboarding.connection.unknown')}</Tag>
            ) : connected ? (
              <Tag color="green">{t('settings:onboarding.connection.connected')}</Tag>
            ) : (
              <Tag color="red">{t('settings:onboarding.connection.failed')}</Tag>
            )}
            <Button size="small" onClick={doTest} loading={testing}>{t('settings:onboarding.buttons.recheck')}</Button>
          </div>
          {connected === false && (
            <Alert
              type="warning"
              showIcon
              message={t('settings:onboarding.connectionFailed')}
              description={t(
                'settings:onboarding.connection.continueAnyway',
                'You can finish setup now and connect later from Settings.'
              )}
            />
          )}
          {typeof ragHealthy !== 'undefined' && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{t('settings:onboarding.rag.label')}</span>
              {ragHealthy === 'healthy' ? <Tag color="green">{t('settings:onboarding.rag.healthy')}</Tag> : ragHealthy === 'unhealthy' ? <Tag color="red">{t('settings:onboarding.rag.unhealthy')}</Tag> : <Tag>{t('settings:onboarding.rag.unknown')}</Tag>}
            </div>
          )}
          {errorDetail && (
            <Alert type="error" showIcon message={t('settings:onboarding.connectionFailed')} description={errorDetail} />
          )}
          <div className="flex justify-end">
            <Space>
              <Button onClick={finish}>{t('settings:onboarding.buttons.skip')}</Button>
              <Button
                type="primary"
                danger={connected === false}
                onClick={finish}
                disabled={testing}
              >
                {connected === false
                  ? t(
                      'settings:onboarding.buttons.finishAnyway',
                      'Finish without connecting'
                    )
                  : t('settings:onboarding.buttons.finish')}
              </Button>
            </Space>
          </div>
        </div>
      )}
    </div>
  )
}

export default OnboardingWizard
