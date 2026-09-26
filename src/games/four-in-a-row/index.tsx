import { defineGame } from '../define';
import { FourInARow, progressSpec } from './FourInARow';

export default defineGame({ Component: FourInARow, progress: progressSpec });
