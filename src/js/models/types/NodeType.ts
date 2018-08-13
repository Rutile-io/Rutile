export enum NodeType {
    // Full nodes can pretty much do everything such as storing files
    // and processing heavy tasks.
    FULL = 'FULL',

    // Web nodes can only execute small tasks. Full nodes can however pickup these tasks too
    // They can also do small database transactions
    WEB = 'NODE',

    // Light nodes are there just to store and execute their own functions
    // No programs that are extern
    LIGHT = 'LIGHT',
}