export default function sortObjKeysAlphabetically(obj: any) {
    // @ts-ignore
    return Object.keys(obj).sort((a, b) => a > b).reduce((result: any, key: string) => {
        result[key] = obj[key];
        return result;
    }, {});
}
