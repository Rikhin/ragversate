// Define the main entity node for storing knowledge
N::Entity {
    name: String,
    category: String,
    source_query: String,
    description: String,
    created_at: I64
}

// Define a vector for storing embeddings
V::EntityEmbedding {
    content: String
}

// Define edge to connect entities to their embeddings
E::EntityToEmbedding {
    From: Entity,
    To: EntityEmbedding,
    Properties: {
        similarity_score: F64
    }
}

// Define edge for entity relationships
E::EntityRelated {
    From: Entity,
    To: Entity,
    Properties: {
        relationship_type: String,
        confidence: F64
    }
} 