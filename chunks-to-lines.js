"use strict";

/**
 * Return an incoming node ID if the node has any input wired to it, false otherwise.
 * If filter callback is not null, then this function filters incoming nodes.
 */
function findInputNodeId(toNode, filter = null) {
	if (toNode && toNode._flow && toNode._flow.global) {
		const allNodes = toNode._flow.global.allNodes;
		for (const fromNodeId of Object.keys(allNodes)) {
			const fromNode = allNodes[fromNodeId];
			if (fromNode.wires) {
				for (const wireId of Object.keys(fromNode.wires)) {
					const wire = fromNode.wires[wireId];
					for (const toNodeId of wire) {
						if (toNode.id === toNodeId && (!filter || filter(fromNode))) {
							return fromNode.id;
						}
					}
				}
			}
		}
	}
	return false;
}

/**
 * Return an outgoing node ID if the node has any output wired to it, false otherwise.
 * If filter callback is not null, then this function filters outgoing nodes.
 */
function findOutputNodeId(fromNode, filter = null) {
	if (fromNode && fromNode.wires && fromNode._flow && fromNode._flow.global) {
		const allNodes = fromNode._flow.global.allNodes;
		for (const wireId of Object.keys(fromNode.wires)) {
			const wire = fromNode.wires[wireId];
			for (const toNodeId of wire) {
				const toNode = allNodes[toNodeId];
				if (!filter || filter(toNode)) {
					return toNode.id;
				}
			}
		}
	}
	return false;
}

module.exports = function (RED) {
	const util = require('util');

	function chunksToLinesNode(config) {
		const node = this;	// jshint ignore:line
		RED.nodes.createNode(node, config);

		//Declare the ability of this node to provide ticks upstream for back-pressure
		node.tickProvider = true;
		let tickUpstreamId;
		let tickUpstreamNode;

		//Declare the ability of this node to consume ticks from downstream for back-pressure
		node.tickConsumer = true;
		let tickDownstreamId;

		const textDecoder = new util.TextDecoder(config.decoder || 'UTF-8');
		//Special case for multi-byte new line in little-endian
		const nlOffset = textDecoder.encoding === 'utf-16le' ? 2 : 1;

		const fifo = [];
		let downstreamReady = true;
		let stringBuffer = '';
		let byteBuffer = new Int8Array(0);
		let linesInBuffer = 1;
		let upstreamPartsId = '';
		let partsIndex = -1;
		node.on('input', function (msg) {
			if (tickDownstreamId === undefined) {
				tickDownstreamId = findOutputNodeId(node, n => RED.nodes.getNode(n.id).tickProvider);
			}
			if (tickUpstreamId === undefined) {
				tickUpstreamId = findInputNodeId(node, n => RED.nodes.getNode(n.id).tickConsumer);
				tickUpstreamNode = tickUpstreamId ? RED.nodes.getNode(tickUpstreamId) : null;
			}

			if (msg.tick) {
				downstreamReady = true;
			} else if (typeof msg.payload === 'string' || ArrayBuffer.isView(msg.payload)) {
				if (msg.parts && msg.parts.abort) {
					//Upstream abort
					stringBuffer = '';
					byteBuffer = new Int8Array(0);
					msg.payload = '';
					msg.parts = {
						id: upstreamPartsId,
						type: 'string',
						ch: '',
						index: partsIndex + 1,
						count: partsIndex + 2,
						abort: true,
					};

					while (fifo.length > 0 && fifo[fifo.length - 1].parts.id === upstreamPartsId) {
						//Clear parts from the former sequence in our FIFO
						fifo.pop();
					}

					linesInBuffer = 1;
					upstreamPartsId = '';
					partsIndex = -1;
					fifo.push(msg);	//Inform downstream
				} else {
					if (msg.parts && msg.parts.id && msg.parts.id !== upstreamPartsId) {
						//Prepare system for a new set of upstream parts
						stringBuffer = '';
						byteBuffer = new Int8Array(0);
						linesInBuffer = 1;
						upstreamPartsId = msg.parts.id || '' + Math.random();
						partsIndex = -1;
						downstreamReady = true;
					}

					const isLastPacket = msg.complete || (msg.parts && msg.parts.hasOwnProperty('count') &&
						msg.parts.hasOwnProperty('index') && msg.parts.index > msg.parts.count);
					delete msg.complete;

					if (typeof msg.payload === 'string') {
						stringBuffer += msg.payload;
						if (msg.parts && msg.parts.ch) {
							msg.payload += msg.parts.ch;
						}
					} else {
						let byteBuffer2 = new Int8Array(byteBuffer.length + msg.payload.length);
						byteBuffer2.set(byteBuffer);
						byteBuffer2.set(msg.payload, byteBuffer.length);
						byteBuffer = byteBuffer2;
						byteBuffer2 = undefined;
					}
					msg.payload = '';
					msg.parts = {
						id: upstreamPartsId,
						type: 'string',
						ch: '',
						index: partsIndex,
					};

					let nbNewLines = 0;
					while (stringBuffer.length > 0 || byteBuffer.length > 0) {
						const msg2 = RED.util.cloneMessage(msg);

						if (stringBuffer.length > 0) {	//ASCII
							const i = stringBuffer.indexOf("\n");
							if (i >= 0) {
								msg2.payload = stringBuffer.substring(0, i + 1);
								stringBuffer = stringBuffer.substring(i + 1);
							} else if (isLastPacket) {
								msg2.payload = stringBuffer;
								stringBuffer = '';
							} else {
								break;
							}
						} else {	//Binary, fine for ASCII, ISO-8859-X, UTF-8, UTF-16, UTF-32
							const i = byteBuffer.findIndex((element, index, array) => element === 0x0A);
							if (i >= 0) {
								msg2.payload = textDecoder.decode(byteBuffer.slice(0, i + nlOffset));
								byteBuffer = byteBuffer.slice(i + nlOffset);
							} else if (isLastPacket) {
								msg2.payload = textDecoder.decode(byteBuffer);
								byteBuffer = new Int8Array(0);
							} else {
								break;
							}
						}

						nbNewLines++;
						msg2.parts.index = ++partsIndex;
						if (isLastPacket && stringBuffer.length === 0 && byteBuffer.length === 0) {
							//Last line from upstream
							msg2.parts.count = partsIndex + 1;
							msg2.complete = true;
							linesInBuffer = nbNewLines = 1;
						}
						fifo.push(msg2);
					}
					linesInBuffer = Math.max(linesInBuffer, nbNewLines);
				}
			} else {
				//Forward unknown type of message
				node.send(msg);
			}

			if (downstreamReady) {
				downstreamReady = false;
				let response = fifo.shift();
				if (response) {
					if (config.nblines > 1) {
						const payloads = [ response.payload ];
						for (let i = config.nblines - 2; i >= 0; i--) {
							const next = fifo.shift();
							if (next) {
								response = next;
								payloads.push(next.payload);
							} else {
								break;
							}
						}
						response.payload = payloads;
					}
					node.send(response);
				}
				if (tickUpstreamNode && fifo.length < linesInBuffer) {
					//If the FIFO length is low enough, ask upstream to send more data
					linesInBuffer = 1;
					tickUpstreamNode.receive({ tick: true });
				}
			}
		});
	}
	RED.nodes.registerType('chunks-to-lines', chunksToLinesNode);
};
