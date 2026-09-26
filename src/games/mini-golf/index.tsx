import { defineGame } from '../define';
import { MiniGolf, saveSpec } from './MiniGolf';

export default defineGame({ Component: MiniGolf, save: saveSpec });
