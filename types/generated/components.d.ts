import type { Schema, Struct } from '@strapi/strapi';

export interface ProjectTag extends Struct.ComponentSchema {
  collectionName: 'components_project_tags';
  info: {
    displayName: 'Tag';
    icon: 'tag';
  };
  attributes: {
    highlighted: Schema.Attribute.Boolean & Schema.Attribute.DefaultTo<false>;
    label: Schema.Attribute.String & Schema.Attribute.Required;
  };
}

declare module '@strapi/strapi' {
  export namespace Public {
    export interface ComponentSchemas {
      'project.tag': ProjectTag;
    }
  }
}
