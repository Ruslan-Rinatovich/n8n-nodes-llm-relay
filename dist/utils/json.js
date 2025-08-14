export const safeJsonParse = (str) => {
    try {
        return JSON.parse(str);
    }
    catch {
        return undefined;
    }
};
export const safeJsonStringify = (value) => {
    try {
        return JSON.stringify(value);
    }
    catch {
        return '';
    }
};
//# sourceMappingURL=json.js.map