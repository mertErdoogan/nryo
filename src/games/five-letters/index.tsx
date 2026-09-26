import { defineGame } from '../define';
import { FiveLetters, saveSpec } from './FiveLetters';

export default defineGame({ Component: FiveLetters, save: saveSpec });
