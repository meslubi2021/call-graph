import { CallHierarchyNode } from "./call"
import * as fs from 'fs'
import { isDeepStrictEqual } from "util"
import path = require("path")

export function generateDot(graph: CallHierarchyNode, filePath?: string) {
    const dot = new Graph()
    dot.addAttr({ rankdir: "LR" })
    const getNode = (n: CallHierarchyNode) => {
        return {
            name: `"${n.item.uri}#${n.item.name}@${n.item.range.start.line}:${n.item.range.start.character}"`,
            attr: { label: n.item.name },
            subgraph: { name: n.item.uri.toString(), attr: { label: n.item.uri.toString() } },
            next: []
        } as Node
    }
    const node = getNode(graph)
    node.attr!.color = "green"
    node.attr!.style = "filled"
    const set = new Set<Node>()

    const insertNode = (n: Node, c: CallHierarchyNode) => {
        set.add(n)
        if (c.children.length > 0) c.children.forEach(child => {
            const next = getNode(child)
            for (const s of set) {
                if (isDeepStrictEqual(s, next)) {
                    n.next.push(s)
                    return
                }
            }
            n.next.push(next)
            insertNode(next, child)
        })
    }
    insertNode(node, graph)
    dot.addNode(node)
    const f = path.resolve(__dirname, '../static/graph_data.dot')
    fs.writeFileSync(f, dot.toString())
    filePath && fs.writeFileSync(filePath, dot.toString())
    console.log('generate dot file successfully: ', f)
    return dot
}

type Attr = Record<string, string> & { title?: string, label?: string, shape?: string, style?: string, color?: string }

interface Node {
    name: string
    attr?: Attr,
    subgraph?: Subgraph
    next: Node[]
}
interface Subgraph {
    name: string
    attr?: Attr & { node?: Attr }
    cluster?: boolean
}
class Graph {
    private _dot = ''
    private _subgraphs = new Map<string, string>()
    private _nodes = new Set<Node>()
    constructor(title?: string) {
        this._dot = (true ? 'digraph' : 'graph') + ` ${title ?? ''} {\n`
    }
    addAttr(attr: Attr) {
        this._dot += this.getAttr(attr, true)
    }
    addNode(...nodes: Node[]) {
        nodes.forEach(n => {
            this._nodes.add(n)
            const name = n.name + this.getAttr(n.attr)
            if (n.subgraph) this.insertToSubgraph(n.subgraph, n.name + ' ')
            let s = ''
            const removeRepeat = [] as number[]
            if (n.next.length > 0) {
                const children = n.next.map((child, index) => {
                    for (const s of this._nodes) {
                        if (isDeepStrictEqual(s, child)) removeRepeat.push(index)
                    }
                    if (child.subgraph) this.insertToSubgraph(child.subgraph, child.name + ' ')
                    return child.name + this.getAttr(child.attr)
                }).join(' ')
                s += `{${name}} -> {${children}}\n`
            }
            else s += name + '\n'
            this._dot += s
            this.addNode(...n.next.filter((_, index) => !removeRepeat.includes(index)))
        })
    }
    private insertToSubgraph(subgraph: Subgraph, s: string) {
        const name = subgraph.name
        if (!this._subgraphs.has(name)) {
            this._subgraphs.set(name, `subgraph "${(subgraph.cluster ?? true ? 'cluster_' : '') + name}" {\n${this.getAttr(subgraph.attr, true)}`)
        }
        this._subgraphs.set(name, this._subgraphs.get(name) + s)
    }

    private getAttr(attr?: Attr, isSelf = false) {
        if (!attr) return ''
        let s = isSelf ? '' : '['
        Object.keys(attr).forEach(k => {
            s += `${k}="${attr[k]}"` + (isSelf ? '\n' : ', ')
        })
        if (!isSelf) s += ']'
        return s
    }
    toString() {
        let sub = ''
        this._subgraphs.forEach((v, k) => {
            sub += v + '}\n'
        })
        return this._dot + sub + '}\n'
    }
}