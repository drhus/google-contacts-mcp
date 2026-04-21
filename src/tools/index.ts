import type {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import type {Config} from './types.js';

import {registerContactsList} from './contacts-list.js';
import {registerContactGet} from './contact-get.js';
import {registerContactSearch} from './contact-search.js';
import {registerContactCreate} from './contact-create.js';
import {registerContactUpdate} from './contact-update.js';
import {registerContactDelete} from './contact-delete.js';
import {registerDirectorySearch} from './directory-search.js';
import {registerContactGroupsList} from './contact-groups-list.js';
import {registerGroupMembersList} from './group-members-list.js';
import {registerContactUpdatePhoto} from './contact-update-photo.js';
import {registerContactAddToGroup} from './contact-add-to-group.js';

export type {Config} from './types.js';

export function registerAll(server: McpServer, config: Config): void {
	registerContactsList(server, config);
	registerContactGet(server, config);
	registerContactSearch(server, config);
	registerContactCreate(server, config);
	registerContactUpdate(server, config);
	registerContactDelete(server, config);
	registerDirectorySearch(server, config);
	registerContactGroupsList(server, config);
	registerGroupMembersList(server, config);
	registerContactUpdatePhoto(server, config);
	registerContactAddToGroup(server, config);
}
