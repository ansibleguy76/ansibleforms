---
# Page settings
layout: default
keywords:
comments: false

# Hero section
title: Custom database schemas
description: | 
  Create custom database schemas using a descriptive yaml language
# Micro navigation
micro_nav: true

# Hide scrollspy
hide_scrollspy: false

# Page navigation
page_nav:
    prev:
        content: FAQ
        url: '/faq'
    next:
        content: Datasources
        url: '/datasource'
---

# Descriptive YAML Language for MySQL Table Creation

## Concept and Goal

In Ansible Forms, it's sometimes handy to have some custom databases.  
Since version 5.0.9 you can now create them with yaml.  
  
This custom descriptive YAML language is designed to simplify the process of creating and managing MySQL tables. The goal is to provide a human-readable and easily maintainable way to define database schemas, including tables, fields, relationships, and constraints. By using this YAML language, developers can quickly design and modify database structures without writing extensive SQL code.

## Language Overview

Each yaml-schema consists of key-value pairs where each key represents a `table`, and the value is a list of `fields`. Each field is defined with a set of `properties` that specify its characteristics. The language provides default values for certain properties to simplify the schema definition.

### Default Values

- **Type**: `varchar`
- **Length**: `255`
- **Nullable**: `true`
- **Default**: `null`

### Auto-Added Fields

- An auto-increment `id` field is automatically added to each table as the primary key.
- Indexes are automatically created based on the defined fields and relationships.

### Natural Key

To add a custom natural key (next to the auto generated primary id), you can use the property `unique`.  All the fields with this property will be combined as 1 unique natural key.  Do note that there is a length restriction for a natural key.  I you use multiple fields as natural key, set the length property as tight as possible, don't use the default 255 if the max length will be 30 for example.

## Field Properties

### Basic Properties

- **name**: The name of the field (required).
- **type**: The data type of the field (default: `varchar`).
- **length**: The length of the field (default: `255`).
- **nullable**: Whether the field can be null (default: `true`).
- **default**: The default value of the field (default: `null`).
- **comment**: A comment describing the field.

### Special Properties

- **unique**: Indicates that the field is a unique key.
- **foreign_key**: Specifies a relationship to another table. The field will be `int` and will receive an `_id` suffix and point to the `id` field of the related table.
- **constraint_actions**: Defines actions for `ON DELETE` and `ON UPDATE` constraints.
- **case_sensitive**: Whether the field is case-sensitive (default: `false`).

## Data Types

Depending on your mysql version, more types might be possible, but the below ones are certainly the most popular ones.

- **varchar**: Variable-length string.
- **text**: Large text field.
- **int**: Integer.
- **tinyint**: Small integer.
- **bigint**: Large integer.
- **decimal** : Fixed-precision number
- **float** : Floating-point with approximate precision
- **double** : Large float
- **bool**: Boolean value.
- **timestamp**: Timestamp.
- **datetime**: Date and time.

## Example Schema

Here are some IT-related examples demonstrating the use of all properties:

### Example 1: Basic Table Definition

```yaml
user:
- {name: username, length: 50, nullable: false, unique: true}
- {name: email, length: 100, nullable: false, unique: true}
- {name: password, nullable: false}
- {name: created_at, type: timestamp, default: 'current_timestamp'}
```

### Example 2: One-to-Many Relationship

Note that the field `author` will become `author_id`, the suffix is auto added.  
It points to the previously defined table in example 1.


```yaml
post:
- {name: title, nullable: false}
- {name: content, type: text, nullable: false}
- {name: is_approved, type: bool}
- {name: author, type: int, foreign_key: user, constraint_actions: delete_cascade}
- {name: created_at, type: timestamp, default: 'current_timestamp'}
```

### Example 3: Many-to-Many Relationship

Note that the fields `post` and `tag` will become `post_id` and `tag_id`.

```yaml
post:
- {name: title, nullable: false}
- {name: content, type: text, nullable: false}
- {name: created_at, type: timestamp, default: 'current_timestamp'}

tag:
- {name: name, length: 50, nullable: false, unique: true}

post_tag:
- {name: post, foreign_key: post, constraint_actions: delete_cascade}
- {name: tag, foreign_key: tag, constraint_actions: delete_cascade}
```

### Example 4 : Case Sensitivity and unique

```yaml
product:
- {name: name, unique: true, length: 100, nullable: false, case_sensitive: true}
- {name: description, type: text}
- {name: price, type: decimal, length: 10, nullable: false}
- {name: created_at, type: timestamp, default: 'current_timestamp'}
```

### Example 5 : Comments, types and constraints

```yaml
order:
- {name: user, type: int, foreign_key: user, constraint_actions: delete_cascade}
- {name: product, foreign_key: product, constraint_actions: delete_cascade}
- {name: quantity, type: int, nullable: false, comment: 'Number of products ordered'}
- {name: total_price, type: decimal, length: 10, nullable: false, comment: 'Total price of the order'}
- {name: order_date, type: datetime, default: 'current_timestamp'}
```