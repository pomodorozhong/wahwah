// Load the actual WASM binary before importing tests that use Mumble generation.
import init from '../src/wasm/wahwah_wasm';
import wasmUrl from '../src/wasm/wahwah_wasm_bg.wasm?inline';
await init({ module_or_path: wasmUrl });
