# Local LLM Getting Started Guide

Run AI models on your own computer with complete privacy. No cloud services, no API costs, no internet required.

---

## Table of Contents

1. [Why Run LLMs Locally?](#why-run-llms-locally)
2. [What You'll Need](#what-youll-need)
3. [Installing Llama.cpp](#installing-llamacpp)
4. [Downloading Your First Model](#downloading-your-first-model)
5. [Running the Server](#running-the-server)
6. [Connecting to tldw Extension](#connecting-to-tldw-extension)
7. [Troubleshooting](#troubleshooting)
8. [Next Steps](#next-steps)

---

## Why Run LLMs Locally?

Running AI models on your own computer offers several benefits:

- **Complete Privacy** - Your conversations never leave your machine. No data is sent to any cloud service.
- **No API Costs** - Once you download a model, you can use it forever without paying per-request fees.
- **Works Offline** - Use AI assistance on airplanes, in remote locations, or anywhere without internet.
- **Full Control** - Choose exactly which model to run and how to configure it.

### What is Llama.cpp?

Llama.cpp is free, open-source software that runs AI models on regular computers. It's designed to be fast and efficient, working well even on laptops without fancy hardware.

### What is GGUF?

GGUF is a file format for AI models. Think of it like MP3 for music or JPEG for images - it's just how the model is packaged. When you download a model from Hugging Face, you'll typically get a `.gguf` file.

---

## What You'll Need

### Hardware Requirements

| Platform | Minimum | Recommended |
|----------|---------|-------------|
| **macOS** | 8GB RAM, Intel or Apple Silicon | 16GB+ RAM, Apple Silicon (M1/M2/M3) |
| **Windows** | 8GB RAM | 16GB+ RAM, NVIDIA GPU (optional) |
| **Linux** | 8GB RAM | 16GB+ RAM, NVIDIA/AMD GPU (optional) |

### Disk Space

Plan for **4-10GB per model**. Smaller models (1-3B parameters) need less space; larger models (7B+) need more.

> **Tip**: Start with a small model (1-3B parameters) to test your setup. You can always download larger models later.

---

## Installing Llama.cpp

### macOS

The easiest way is using Homebrew. Open Terminal and run:

```bash
brew install llama.cpp
```

If you don't have Homebrew installed, visit [brew.sh](https://brew.sh) first.

### Windows

1. Go to the [Llama.cpp Releases page](https://github.com/ggml-org/llama.cpp/releases)
2. Download the latest `llama-*-bin-win-*.zip` file
   - Choose `cuda` version if you have an NVIDIA GPU
   - Choose `avx2` version for most modern CPUs
3. Extract the ZIP to a folder (e.g., `C:\llama.cpp`)
4. Add the folder to your PATH, or navigate to it in Command Prompt when running commands

### Linux

#### Option 1: Build from source (recommended)

```bash
# Install dependencies
sudo apt update
sudo apt install build-essential cmake git

# Clone and build
git clone https://github.com/ggml-org/llama.cpp.git
cd llama.cpp
cmake -B build
cmake --build build --config Release

# The executables will be in ./build/bin/
```

#### Option 2: Pre-built binaries

Download from the [Releases page](https://github.com/ggml-org/llama.cpp/releases) and extract.

---

## Downloading Your First Model

Llama.cpp can download models directly from Hugging Face. No account required for most models.

### Recommended Starter Models

| Model | Size | Good For |
|-------|------|----------|
| `ggml-org/gemma-3-1b-it-GGUF` | ~1GB | Quick tests, basic chat |
| `bartowski/Llama-3.2-3B-Instruct-GGUF` | ~2GB | Good balance of speed and quality |
| `bartowski/Llama-3.1-8B-Instruct-GGUF` | ~5GB | Better quality, needs more RAM |

### Download and Test a Model

Run this command to download a small model and test it:

```bash
llama-cli -hf ggml-org/gemma-3-1b-it-GGUF -p "Hello! Tell me a fun fact."
```

This will:
1. Download the model from Hugging Face (first time only)
2. Cache it locally for future use
3. Generate a response

> **Note**: The first download may take a few minutes depending on your internet speed.

### Understanding Quantization (Model Sizes)

You'll see model files with names like `Q4_K_M` or `Q8_0`. These are "quantization" levels - different quality/size tradeoffs:

| Quantization | Quality | Size | When to Use |
|--------------|---------|------|-------------|
| Q4_K_M | Good | Smallest | Limited RAM, faster responses |
| Q5_K_M | Better | Medium | Good balance |
| Q6_K | Great | Larger | Quality matters more |
| Q8_0 | Best | Largest | Plenty of RAM available |

**For beginners**: Start with `Q4_K_M` - it's fast and works well for most uses.

---

## Running the Server

To use your local LLM with the tldw extension, you need to run it as a server.

### Start the Server

```bash
llama-server -hf ggml-org/gemma-3-1b-it-GGUF
```

You should see output like:

```text
main: server listening on http://127.0.0.1:8080
```

**Leave this terminal window open** - the server needs to keep running.

### Verify It's Working

Open a new terminal and run:

```bash
curl http://localhost:8080/health
```

You should see `{"status":"ok"}` or similar.

Or simply open `http://localhost:8080` in your browser - you'll see a simple chat interface.

### Server Options

| Option | Example | Description |
|--------|---------|-------------|
| `-hf` | `-hf user/model` | Download model from Hugging Face |
| `-m` | `-m ./model.gguf` | Use a local model file |
| `--port` | `--port 8888` | Use a different port |
| `-ngl` | `-ngl 35` | GPU layers (if you have a GPU) |
| `-c` | `-c 4096` | Context size (memory for conversation) |

**Example with options:**

```bash
llama-server -hf bartowski/Llama-3.2-3B-Instruct-GGUF --port 8080 -c 4096
```

---

## Connecting to tldw Extension

You have two options for connecting your local LLM to the tldw extension:

### Option A: Direct Connection (Simple)

This is the quickest way to get started.

1. **Make sure your Llama.cpp server is running** (see previous section)

2. **Open the tldw extension** and go to **Settings**

3. **Navigate to Providers** section

4. **Add a new provider:**
   - Provider type: `Llama.cpp` or `OpenAI-compatible`
   - Base URL: `http://localhost:8080/v1`
   - API Key: Leave empty (not required for local)

5. **Select your model** in the chat interface and start chatting!

### Option B: Via tldw_server (Full Features)

If you're running tldw_server, you can route your local LLM through it for additional features like RAG (retrieval-augmented generation) and unified model management.

1. **Start your Llama.cpp server** on port 8080 (or another port)

2. **Configure tldw_server** to use Llama.cpp as a backend:
   - Refer to tldw_server documentation for provider configuration
   - Add Llama.cpp as an OpenAI-compatible endpoint

3. **In the extension**, connect to tldw_server:
   - Server URL: `http://127.0.0.1:8000` (default)
   - The extension will see your local model alongside any other configured providers

**Benefits of using tldw_server:**
- Unified API for multiple model providers
- RAG integration with your knowledge base
- Model switching without reconfiguring the extension
- Additional processing features

---

## Troubleshooting

### "Connection refused" or "Cannot connect"

**Cause**: The Llama.cpp server isn't running.

**Fix**:
1. Open a terminal and start the server: `llama-server -hf ggml-org/gemma-3-1b-it-GGUF`
2. Keep the terminal window open
3. Check that you see "server listening on..." in the output

### Slow responses

**Cause**: Model too large for your hardware, or no GPU acceleration.

**Fix**:
- Try a smaller model (1B or 3B parameters)
- Use a more aggressive quantization (Q4_K_M instead of Q8_0)
- Close other applications to free up RAM
- If you have a GPU, add `-ngl 35` (or higher) to use GPU acceleration

### Out of memory errors

**Cause**: Model requires more RAM than available.

**Fix**:
- Use a smaller model
- Use a smaller quantization (Q4_K_M)
- Close memory-heavy applications (browsers with many tabs, etc.)
- Reduce context size: add `-c 2048` to the server command

### Model not found in extension

**Cause**: Extension can't detect the model.

**Fix**:
1. Verify the server is running at the correct URL
2. In extension settings, make sure the Base URL ends with `/v1` (e.g., `http://localhost:8080/v1`)
3. Try refreshing the model list in the extension

### macOS: "llama-server: command not found"

**Cause**: Homebrew binaries not in PATH.

**Fix**:
```bash
# Try the full path
/opt/homebrew/bin/llama-server -hf ggml-org/gemma-3-1b-it-GGUF

# Or add to PATH
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

### Windows: "CUDA not found" warnings

**Cause**: Using CUDA build without NVIDIA drivers.

**Fix**: This is just a warning. Either:
- Ignore it (CPU will be used instead)
- Download the non-CUDA (avx2) build instead
- Install NVIDIA CUDA Toolkit if you have an NVIDIA GPU

---

## Next Steps

Once you're comfortable with the basics:

### Try Different Models

Browse models on Hugging Face with the `gguf` tag:
- [Hugging Face GGUF Models](https://huggingface.co/models?library=gguf)

Popular choices:
- **Mistral** - Fast and capable
- **Llama 3** - Meta's latest models
- **Qwen** - Good multilingual support
- **Phi** - Microsoft's efficient small models

### Enable GPU Acceleration

If you have an NVIDIA GPU:

```bash
llama-server -hf bartowski/Llama-3.2-3B-Instruct-GGUF -ngl 99
```

The `-ngl` flag specifies how many layers to offload to GPU. Higher = faster, but uses more VRAM.

### Explore Advanced Features

- **Context size**: Increase `-c` for longer conversations (uses more RAM)
- **Multiple models**: Use llama.cpp's new router mode to switch models without restarting
- **System prompts**: Customize the AI's behavior

### Learn More

- [Llama.cpp GitHub](https://github.com/ggml-org/llama.cpp) - Official documentation
- [Hugging Face GGUF Docs](https://huggingface.co/docs/hub/main/en/gguf-llamacpp) - Model format details
- [Llama.cpp Model Management](https://huggingface.co/blog/ggml-org/model-management-in-llamacpp) - Advanced server features

---

## Quick Reference

### Common Commands

```bash
# Test a model
llama-cli -hf ggml-org/gemma-3-1b-it-GGUF -p "Hello!"

# Start server (basic)
llama-server -hf ggml-org/gemma-3-1b-it-GGUF

# Start server (with options)
llama-server -hf bartowski/Llama-3.2-3B-Instruct-GGUF --port 8080 -c 4096 -ngl 35

# Check server health
curl http://localhost:8080/health
```

### Default Ports

| Service | Port | URL |
|---------|------|-----|
| Llama.cpp | 8080 | `http://localhost:8080` |
| tldw_server | 8000 | `http://localhost:8000` |

### Extension Settings

| Setting | Value |
|---------|-------|
| Provider Type | Llama.cpp / OpenAI-compatible |
| Base URL | `http://localhost:8080/v1` |
| API Key | (leave empty) |
