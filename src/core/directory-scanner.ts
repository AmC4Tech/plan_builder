
import fs from 'fs-extra';
import path from 'path';

export interface FileNode {
    name: string;
    path: string; // Absolute path
    relativePath: string; // Relative to root
    type: 'file' | 'directory';
    extension?: string;
    children?: FileNode[];
}

export class DirectoryScanner {
    /**
     * Scan a directory recursively and return a tree structure
     */
    async scan(dirPath: string, rootPath: string = dirPath): Promise<FileNode[]> {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        const nodes: FileNode[] = [];

        for (const item of items) {
            const absolutePath = path.join(dirPath, item.name);
            const relativePath = path.relative(rootPath, absolutePath);

            if (item.isDirectory()) {
                const children = await this.scan(absolutePath, rootPath);
                nodes.push({
                    name: item.name,
                    path: absolutePath,
                    relativePath,
                    type: 'directory',
                    children
                });
            } else {
                nodes.push({
                    name: item.name,
                    path: absolutePath,
                    relativePath,
                    type: 'file',
                    extension: path.extname(item.name).toLowerCase()
                });
            }
        }

        return nodes;
    }

    /**
     * Flatten the tree to a list of files
     */
    flatten(nodes: FileNode[]): FileNode[] {
        let result: FileNode[] = [];
        for (const node of nodes) {
            if (node.type === 'file') {
                result.push(node);
            } else if (node.children) {
                result = result.concat(this.flatten(node.children));
            }
        }
        return result;
    }
}

export const directoryScanner = new DirectoryScanner();
export default directoryScanner;
