import getConfig from "../Configuration";

class NodesService {
    static async getConnections(): Promise<any[]> {
        const response = await fetch(`http://${getConfig('connectionServerUrl')}/nodes`);

        if (!response.ok) {
            throw new Error('Could not fetch connections');
        }

        const data = await response.json();
        const result: any[] = data.Result;

        return result;
    }
}

export default NodesService;
