import { defineGame } from '../define';
import { BounceBarrage, saveSpec } from './BounceBarrage';

export default defineGame({ Component: BounceBarrage, save: saveSpec });
