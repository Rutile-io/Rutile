export type Arrayish = string | ArrayLike<number>;

export interface Hexable {
    toHexString(): string;
}

export function isHexable(value: any): value is Hexable {
    return !!(value.toHexString);
}

function addSlice(array: Uint8Array): Uint8Array {
    if (array.slice) { return array; }

    array.slice = function() {
        var args = Array.prototype.slice.call(arguments);
        return new Uint8Array(Array.prototype.slice.apply(array, args));
    }

    return array;
}


export function isArrayish(value: any): value is Arrayish {
    if (!value || parseInt(String(value.length)) != value.length || typeof(value) === 'string') {
        return false;
    }

    for (var i = 0; i < value.length; i++) {
        var v = value[i];
        if (v < 0 || v >= 256 || parseInt(String(v)) != v) {
            return false;
        }
    }

    return true;
}


export function arrayify(value: Arrayish | Hexable): Uint8Array {
    if (value == null) {
        console.error('cannot convert null value to array', 'errors.INVALID_ARGUMENT', { arg: 'value', value: value });
    }

    if (isHexable(value)) {
        value = value.toHexString();
    }

    if (typeof(value) === 'string') {
        let match = value.match(/^(0x)?[0-9a-fA-F]*$/);

        if (!match) {
            console.error('invalid hexidecimal string', 'errors.INVALID_ARGUMENT', { arg: 'value', value: value });
        }

        var result = [];
        for (var i = 0; i < value.length; i += 2) {
            result.push(parseInt(value.substr(i, 2), 16));
        }

        return addSlice(new Uint8Array(result));
    }

    if (isArrayish(value)) {
        return addSlice(new Uint8Array(value));
    }

    console.error('invalid arrayify value', null, { arg: 'value', value: value, type: typeof(value) });
    return null;
}
