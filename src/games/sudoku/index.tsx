import { defineGame } from '../define';
import { saveSpec, Sudoku } from './Sudoku';

export default defineGame({ Component: Sudoku, save: saveSpec });
