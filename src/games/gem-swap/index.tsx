import { defineGame } from '../define';
import { GemSwap, saveSpec } from './GemSwap';

export default defineGame({ Component: GemSwap, save: saveSpec });
