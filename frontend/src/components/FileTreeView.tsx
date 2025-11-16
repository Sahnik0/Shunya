"use client"

import React from "react"
import { hotkeysCoreFeature, syncDataLoaderFeature } from "@headless-tree/core"
import { useTree } from "@headless-tree/react"

import { Tree, TreeItem, TreeItemLabel } from "@/components/ui/tree"

interface FileItem {
    path: string
    type: 'file' | 'folder'
    description: string
}

interface TreeNode {
    name: string
    fullPath: string
    type: 'file' | 'folder'
    children?: string[]
}

interface FileTreeViewProps {
    fileStructure: FileItem[]
}

// Convert flat file structure to tree structure
function buildTreeStructure(files: FileItem[]): Record<string, TreeNode> {
    const nodes: Record<string, TreeNode> = {}
    const folderChildren: Record<string, Set<string>> = {}

    // Sort files so folders come first, then by path
    const sortedFiles = [...files].sort((a, b) => {
        if (a.type !== b.type) {
            return a.type === 'folder' ? -1 : 1
        }
        return a.path.localeCompare(b.path)
    })

    // First pass: create all nodes
    sortedFiles.forEach(file => {
        const pathParts = file.path.split('/')
        const fileName = pathParts[pathParts.length - 1]
        
        nodes[file.path] = {
            name: fileName,
            fullPath: file.path,
            type: file.type,
            children: file.type === 'folder' ? [] : undefined
        }

        // Track folder children
        if (pathParts.length > 1) {
            const parentPath = pathParts.slice(0, -1).join('/')
            if (!folderChildren[parentPath]) {
                folderChildren[parentPath] = new Set()
            }
            folderChildren[parentPath].add(file.path)
        }
    })

    // Second pass: assign children to folders
    Object.keys(folderChildren).forEach(folderPath => {
        if (nodes[folderPath]) {
            nodes[folderPath].children = Array.from(folderChildren[folderPath])
        }
    })

    // Create root node
    const rootChildren = sortedFiles
        .filter(f => !f.path.includes('/'))
        .map(f => f.path)

    nodes['root'] = {
        name: 'Project',
        fullPath: 'root',
        type: 'folder',
        children: rootChildren
    }

    return nodes
}

const indent = 20

export function FileTreeView({ fileStructure }: FileTreeViewProps) {
    const treeNodes = React.useMemo(() => buildTreeStructure(fileStructure), [fileStructure])

    // Get all folder paths for initial expansion
    const folderPaths = React.useMemo(() => {
        return fileStructure
            .filter(item => item.type === 'folder')
            .map(item => item.path)
    }, [fileStructure])

    const tree = useTree<TreeNode>({
        initialState: {
            expandedItems: folderPaths.slice(0, 3), // Expand first 3 folders by default
        },
        indent,
        rootItemId: "root",
        getItemName: (item) => item.getItemData().name,
        isItemFolder: (item) => item.getItemData().type === 'folder',
        dataLoader: {
            getItem: (itemId) => treeNodes[itemId],
            getChildren: (itemId) => treeNodes[itemId]?.children ?? [],
        },
        features: [syncDataLoaderFeature, hotkeysCoreFeature],
    })

    return (
        <div className="flex h-full flex-col gap-2">
            <Tree indent={indent} tree={tree} className="bg-card border border-border rounded-lg p-4">
                {tree.getItems().map((item) => {
                    return (
                        <TreeItem key={item.getId()} item={item}>
                            <TreeItemLabel className="font-mono text-sm" />
                        </TreeItem>
                    )
                })}
            </Tree>
        </div>
    )
}
