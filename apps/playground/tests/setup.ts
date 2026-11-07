// Load the actual WASM binary before importing tests that use Mumble generation.
import { loadVoices } from 'wahwah';
import wasmUrl from '../../../packages/wahwah/src/wasm/wahwah_wasm_bg.wasm?inline';
await loadVoices(wasmUrl);
