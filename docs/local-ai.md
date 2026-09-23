# Lightweight on-device AI

The planner uses WebLLM in a Web Worker, so prompts and generated plans stay on the user's device.

Model preference:

1. **Qwen2.5 1.5B Instruct, 4-bit** — recommended balance of quality and download size.
2. **Qwen2.5 0.5B Instruct, 4-bit** — automatic fallback for lower-memory devices.
3. **Llama 3.2 1B Instruct, 4-bit** — optional fallback when exposed by the installed WebLLM model registry.

The app selects the first model present in `prebuiltAppConfig`; it does not download a model until the user chooses on-device AI. WebGPU is required. Free rule-based templates remain available if the browser cannot run a model.
