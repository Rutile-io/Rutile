/**
 * Waits a given amount of time before resolving
 *
 * @export
 * @param {number} ms
 * @returns
 */
export default function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
