// Creation Queries
QUERY createEntity (name: String, category: String, source_query: String, description: String, created_at: I64) =>
    // Create the entity node
    entity <- AddN<Entity>({
        name: name,
        category: category,
        source_query: source_query,
        description: description,
        created_at: created_at
    })
    
    RETURN entity

// Read Queries
QUERY getAllEntities () =>
    // Get all entities
    entities <- N<Entity>
    RETURN entities

QUERY getEntityById (entity_id: ID) =>
    // Get specific entity by ID
    entity <- N<Entity>(entity_id)
    RETURN entity 