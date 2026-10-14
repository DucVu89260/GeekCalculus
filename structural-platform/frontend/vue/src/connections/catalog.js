import registry from '../../../../connection-catalog/connection-registry.json' with { type: 'json' }

export const CONNECTION_REGISTRY = registry
export const CONNECTION_GROUPS = Object.freeze(registry.groups)
export const CONNECTION_FAMILIES = Object.freeze(registry.families)
export const CONNECTION_TYPES = Object.freeze(registry.connections)
