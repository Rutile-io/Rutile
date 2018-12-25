const g = 10;
const bV = 0;
const s = 10000;

function calcB(bV) {
    if (bV === 0) {
        return 0;
    } else {
        return bV**bV;
    }
}

const r = ((g + s) / calcB(bV)) - calcB(bV);

console.log('[] r -> ', r);