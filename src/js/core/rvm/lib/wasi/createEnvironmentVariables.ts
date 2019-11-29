import CallMessage from "../CallMessage";


/**
 * Converts a call message to environment variables
 * see https://github.com/oasislabs/rfcs/blob/e99ddc2a389d3858cde427d14d51a6ccd624361a/blockchain_wasi.md
 *
 * @export
 * @param {CallMessage} callMessage
 * @returns
 */
export default async function createEnvironmentVariables(callMessage: CallMessage) {
    return {
        address: callMessage.destination,
        gas_left: callMessage.gas,
        sender: callMessage.sender,
        value: callMessage.value.toNumber(),
        '$HOME': `/home/${callMessage.destination}`
    }
}
