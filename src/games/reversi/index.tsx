import { defineGame } from '../define';
import { progressSpec, Reversi } from './Reversi';

export default defineGame({ Component: Reversi, progress: progressSpec });
