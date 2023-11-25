/**
 * Validate that a given value is a {@link Command} object
 */
const isCommand = (value, warn = false) => {
    if (typeof value !== 'object' || value === null) {
        if (warn)
            console.warn('Expected command to be an object');
        return false;
    }
    if (typeof value.name !== 'string' || !value.name.length) {
        if (warn)
            console.warn('Expected command to have a name');
        return false;
    }
    if (typeof value.description !== 'string' || !value.description.length) {
        if (warn)
            console.warn('Expected command to have a description');
        return false;
    }
    if (typeof value.execute !== 'function') {
        if (warn)
            console.warn('Expected command to have an execute function');
        return false;
    }
    return true;
};
/**
 * Validate that a set of values are {@link Command} objects
 */
export const validateCommands = (cmds, warn = false) => cmds.reduce((acc, cmd) => {
    if (!isCommand(cmd, warn))
        return acc;
    const command = cmd;
    // Check the command doesn't already exist
    if (acc[command.name]) {
        if (warn)
            console.warn(`Command ${command.name} already exists`);
        return acc;
    }
    // Add the command
    return {
        ...acc,
        [command.name]: command,
    };
}, {});
/**
 * Validate that a given value is a {@link Component} object
 */
const isComponent = (value, warn = false) => {
    if (typeof value !== 'object' || value === null) {
        if (warn)
            console.warn('Expected component to be an object');
        return false;
    }
    if (typeof value === 'object' && value !== null && 'name' in value && typeof value.name === 'string' && value.name.length > 0) {
        if (warn)
            console.warn('Expected component to have a name');
        return false;
    }
    if (typeof value === 'object' && value !== null && 'execute' in value && typeof value.execute === 'function') {
        if (warn)
            console.warn('Expected component to have an execute function');
        return false;
    }
    return true;
};
/**
 * Validate that a set of values are {@link Component} objects
 */
export const validateComponents = (cmps, warn = false) => cmps.reduce((acc, cmp) => {
    if (!isComponent(cmp, warn))
        return acc;
    const component = cmp;
    // Check the component doesn't already exist
    if (acc[component.name]) {
        if (warn)
            console.warn(`Component ${component.name} already exists`);
        return acc;
    }
    // Add the component
    return {
        ...acc,
        [component.name]: component,
    };
}, {});
