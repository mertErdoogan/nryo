import { defineGame } from '../define';
import { PipeLink, progressSpec, saveSpec } from './PipeLink';

export default defineGame({ Component: PipeLink, save: saveSpec, progress: progressSpec });
