'use strict';
/**
 * Command-line interface for Node-RED nodes.
 *
 * Script to run our Node-RED nodes from terminal without Node-RED and using STDIN / STDOUT.
 *
 * @author Alexandre Alapetite <https://alexandra.dk/alexandre.alapetite>
 * @copyright Alexandra Institute <https://alexandra.dk> for the SynchroniCity European project <https://synchronicity-iot.eu>
 * 	as a contribution to FIWARE <https://www.fiware.org>
 * @license MIT
 * @date 2019-11-28 / 2022-02-02
 */

// Load fake/mocked Node-RED
const RED = require('node-red-contrib-mock-cli');
const noderedNode = RED.load(require.main);

if (noderedNode) {
	RED.run();
} else {
	console.error('Error loading Node-RED node!');
}
