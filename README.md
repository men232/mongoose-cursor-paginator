# Pagination plugin for mongoose >= 6.x <!-- omit in toc -->

![license](https://img.shields.io/npm/l/%40andrew_l%2Fmongoose-cursor-paginator) ![npm version](https://img.shields.io/npm/v/%40andrew_l%2Fmongoose-cursor-paginator)

## Installation

`npm i @andrew_l/mongoose-cursor-paginator`

```js
import mongoose from 'mongoose';
import { setupPlugin } from '@andrew_l/mongoose-cursor-paginator';

setupPlugin(mongoose);
```

## Usage examples

Simple search with catching filter & sort options of original mongoose query.

```js
// Fetch the first page
const firstPage = await Users.find({ role: 'admin' })
  .limit(10)
  .sort({ createdAt: -1 })
  .lean()
  .paginator();

console.log(firstPage);
/* {
  "metadata": {
    "hasNext": true,
    "next": "ldkkZjBhZTViZTQtNzRkNC00YzY2LWI2MWItYjMzYjE0NzQwODI4pFVzZXKBo19pZP-Bo19pZNkkZjBhZTViZTQtNzRkNC00YzY2LWI2MWItYjMzYjE0NzQwODI4gA"
  },
  "items": [
    { doc_1 },
    { doc_n },
    ...
    { doc_10 },
  ]
} */

const secondPage = await Users.find({ role: 'admin' })
  .limit(10)
  // sort can be overwrited by next token
  .sort({ createdAt: -1 })
  .lean()
  .paginator({ next: firstPage.metadata.next });

console.log(secondPage);
/* {
  "metadata": {
    "hasNext": false,
    "next": null
  },
  "items": [
    { doc_1 },
    { doc_2 },
    { doc_3 }
  ]
} */
```

## Advanced usage

```js
// Make query with some criteria
const firstPage = await searchUsers({
  role: 'admin',
});

// Now we can use only next token and keep the role filter from previous query
const secondPage = await searchUsers({
  next: firstPage.metadata.next,
});

function searchUsers(search) {
  const savedSearch = {};

  const paign = User.find()
    .lean()
    .sort({ status: 1, createdAt: -1, _id: 1 })
    .limit(50)
    .paginator({
      next: search.next,
      // Exclude `status` from pagination cursor.
      paginationFields: ['createdAt', '_id'],

      // Save search params into token payload
      preQuery() {
        this.nextToken.payload = savedSearch;
      },
    });

  // Use token payload as search params
  if (paign.previousToken?.payload) {
    search = paign.previousToken?.payload;
  }

  const filter = {};

  if (typeof search.role === 'string' && search.role) {
    // Save role for next query
    savedSearch.role = search.role;

    // Use role as filter condition
    filter.role = search.role;
  }

  // Update query filter
  paign.getQuery().setQuery(filter);

  return paign.exec();
}
```

## Stream example

```js
const query = await Users.find({ role: 'admin' });

const dbStream = await query.paginator.stream();

stream.on('data', console.log);
stream.on('end', () => {
  const metadata = query.paginator().getMetadata();

  console.log({ metadata });

  /* {
      "metadata": {
    	"hasNext": true,
    	"next": "ldkkZjBhZTViZTQtNzRkNC00YzY2LWI2MWItYjMzYjE0NzQwODI4pFVzZXKBo19pZP-Bo19pZNkkZjBhZTViZTQtNzRkNC00YzY2LWI2MWItYjMzYjE0NzQwODI4gA"
      }
    */
});
```

### Tips
- The last sorting key **must be uniq** & sortable (Number, ObjectId is perfect)
