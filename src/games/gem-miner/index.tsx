import { defineGame } from '../define';
import { GemMiner, progressSpec, saveSpec } from './GemMiner';

export default defineGame({ Component: GemMiner, save: saveSpec, progress: progressSpec });
