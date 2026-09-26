import { defineGame } from '../define';
import { Merge2048, saveSpec } from './Merge2048';

export default defineGame({ Component: Merge2048, save: saveSpec });
