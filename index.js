import Rutile from './src/js';
import isNodeJs from './src/js/services/isNodeJs';

if (!isNodeJs()) {
    window.Rutile = Rutile;
}