export default function getArguments(args: string[]): { [key: string]: string } {
    let nextIsValue = false;
    let previousKey = '';
    let result = {};

    for (let index = 0; index < args.length; index++) {
        const element = args[index];

        if (nextIsValue) {
            nextIsValue = false;
            result[previousKey] = element;
        }

        if (element.startsWith('--')) {
            nextIsValue = true;
            previousKey = element.substring(2);
        }
    }

    return result;
}
