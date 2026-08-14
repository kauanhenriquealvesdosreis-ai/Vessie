export function preserveExisting(existing,incoming){return existing==null||existing===''?incoming:existing}
export function mergeJSX(existing,incoming){if(!existing)return incoming;if(!incoming)return existing;return `${existing}\n\n/* VessieAI merged extension */\n${incoming}`}
export function patchFile(current,patch){if(!patch)return current;return current.replace(patch.find||'',patch.replace??'')}
