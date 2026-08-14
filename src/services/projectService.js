import {pickDirectory,writeFile} from '../projects/files.js';
export async function createProjectFiles(files){const root=await pickDirectory();for(const f of files)await writeFile(root,f.path,f.content);return root}
