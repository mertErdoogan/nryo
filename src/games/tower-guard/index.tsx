import { defineGame } from '../define';
import { saveSpec, TowerGuard } from './TowerGuard';

export default defineGame({ Component: TowerGuard, save: saveSpec });
