---
title: "Joplin Data API | Joplin"
source: "https://joplinapp.org/help/api/references/rest_api/"
author:
  - "[[​]]"
  - "[[Authorisation]]"
published:
created: 2025-08-06
description: "This API is available when the clipper server is running. It provides access to the notes, notebooks, tags and other Joplin object via a REST API. Plugins can also access this API even when the cli..."
tags:
  - "clippings"
---
## Joplin Data API

This API is available when the clipper server is running. It provides access to the notes, notebooks, tags and other Joplin object via a REST API. Plugins can also access this API even when the clipper server is not running.

In order to use it, you'll first need to find on which port the service is running. To do so, open the Web Clipper Options in Joplin and if the service is running it should tell you on which port. Normally it runs on port **41184**. If you want to find it programmatically, you may follow this kind of algorithm:

```javascript
let port = null;
for (let portToTest = 41184; portToTest <= 41194; portToTest++) {
    const result = pingPort(portToTest); // Call GET /ping
    if (result == 'JoplinClipperServer') {
        port = portToTest; // Found the port
        break;
    }
}
```

## Authorisation

To prevent unauthorised applications from accessing the API, the calls must be authenticated. To do so, you must provide a token as a query parameter for each API call. You can get this token from the Joplin desktop application, on the Web Clipper Options screen.

This would be an example of valid cURL call using a token:

```shell
curl http://localhost:41184/notes?token=ABCD123ABCD123ABCD123ABCD123ABCD123
```

In the documentation below, the token will not be specified every time however you will need to include it.

If needed you may also [request the token programmatically](https://joplinapp.org/help/dev/spec/clipper_auth)

## Using the API

All the calls, unless noted otherwise, receives and send **JSON data**. For example to create a new note:

```shell
curl --data '{ "title": "My note", "body": "Some note in **Markdown**"}' http://localhost:41184/notes
```

In the documentation below, the calls may include special parameters such as:id or:note\_id. You would replace this with the item ID or note ID.

For example, for the endpoint `DELETE /tags/:id/notes/:note_id`, to remove the tag with ID "ABCD1234" from the note with ID "EFGH789", you would run for example:

```shell
curl -X DELETE http://localhost:41184/tags/ABCD1234/notes/EFGH789
```

The four verbs supported by the API are the following ones:

- **GET**: To retrieve items (notes, notebooks, etc.).
- **POST**: To create new items. In general most item properties are optional. If you omit any, a default value will be used.
- **PUT**: To update an item. Note in a REST API, traditionally PUT is used to completely replace an item, however in this API it will only replace the properties that are provided. For example if you PUT {"title": "my new title"}, only the "title" property will be changed. The other properties will be left untouched (they won't be cleared nor changed).
- **DELETE**: To delete items.

## Filtering data

You can change the fields that will be returned by the API using the `fields=` query parameter, which takes a list of comma separated fields. For example, to get the longitude and latitude of a note, use this:

```shell
curl http://localhost:41184/notes/ABCD123?fields=longitude,latitude
```

To get the IDs only of all the tags:

```shell
curl http://localhost:41184/tags?fields=id
```

By default API results will contain the following fields: **id**, **parent\_id**, **title**

## Pagination

All API calls that return multiple results will be paginated and will return the following structure:

| Key | Always present? | Description |
| --- | --- | --- |
| `items` | Yes | The array of items you have requested. |
| `has_more` | Yes | If `true`, there are more items after this page. If `false`, it means you have reached the end of the data set. |

You can specify how the results should be sorted using the `order_by` and `order_dir` query parameters, and which page to retrieve using the `page` parameter (starts at and defaults to 1). You can specify the number of items to be returned using the `limit` parameter (the maximum being 100 items).

The following call for example will initiate a request to fetch all the notes, 10 at a time, and sorted by "updated\_time" ascending:

```shell
curl http://localhost:41184/notes?order_by=updated_time&order_dir=ASC&limit=10
```

This will return a result like this

```json
{ "items": [ /* 10 notes */ ], "has_more": true }
```

Then you will resume fetching the results using this query:

```shell
curl http://localhost:41184/notes?order_by=updated_time&order_dir=ASC&limit=10&page=2
```

Eventually you will get some results that do not contain an "has\_more" parameter, at which point you will have retrieved all the results

As an example the pseudo-code below could be used to fetch all the notes:

```javascript
async function fetchJson(url) {
    return (await fetch(url)).json();
}

async function fetchAllNotes() {
    let pageNum = 1;
    do {
        const response = await fetchJson((http://localhost:41184/notes?page=' + pageNum++);
        console.info('Printing notes:', response.items);
    } while (response.has_more)
}
```

In case of an error, an HTTP status code >= 400 will be returned along with a JSON object that provides more info about the error. The JSON object is in the format `{ "error": "description of error" }`.

## About the property types

- Text is UTF-8.
- All date/time are Unix timestamps in milliseconds.
- Booleans are integer values 0 or 1.

## Testing if the service is available

Call **GET /ping** to check if the service is available. It should return "JoplinClipperServer" if it works.

## Searching

Call **GET /search?query=YOUR\_QUERY** to search for notes. This end-point supports the `field` parameter which is recommended to use so that you only get the data that you need. The query syntax is as described in the main documentation: [https://joplinapp.org/help/apps/search](https://joplinapp.org/help/apps/search)

To retrieve non-notes items, such as notebooks or tags, add a `type` parameter and set it to the required [item type name](https://joplinapp.org/help/api/references/rest_api/#item-type-ids). In that case, full text search will not be used - instead it will be a simple case-insensitive search. You can also use `*` as a wildcard. This is convenient for example to retrieve notebooks or tags by title.

For example, to retrieve the notebook named `recipes`: **GET /search?query=recipes&type=folder**

To retrieve all the tags that start with `project-`: **GET /search?query=project-\*&type=tag**

## Item type IDs

Item type IDs might be referred to in certain objects you will retrieve from the API. This is the correspondence between name and ID:

| Name | Value |
| --- | --- |
| note | 1 |
| folder | 2 |
| setting | 3 |
| resource | 4 |
| tag | 5 |
| note\_tag | 6 |
| search | 7 |
| alarm | 8 |
| master\_key | 9 |
| item\_change | 10 |
| note\_resource | 11 |
| resource\_local\_state | 12 |
| revision | 13 |
| migration | 14 |
| smart\_filter | 15 |
| command | 16 |

## Notes

### Properties

| Name | Type | Description |
| --- | --- | --- |
| id | text |  |
| parent\_id | text | ID of the notebook that contains this note. Change this ID to move the note to a different notebook. |
| title | text | The note title. |
| body | text | The note body, in Markdown. May also contain HTML. |
| created\_time | int | When the note was created. |
| updated\_time | int | When the note was last updated. |
| is\_conflict | int | Tells whether the note is a conflict or not. |
| latitude | numeric |  |
| longitude | numeric |  |
| altitude | numeric |  |
| author | text |  |
| source\_url | text | The full URL where the note comes from. |
| is\_todo | int | Tells whether this note is a todo or not. |
| todo\_due | int | When the todo is due. An alarm will be triggered on that date. |
| todo\_completed | int | Tells whether todo is completed or not. This is a timestamp in milliseconds. |
| source | text |  |
| source\_application | text |  |
| application\_data | text |  |
| order | numeric |  |
| user\_created\_time | int | When the note was created. It may differ from created\_time as it can be manually set by the user. |
| user\_updated\_time | int | When the note was last updated. It may differ from updated\_time as it can be manually set by the user. |
| encryption\_cipher\_text | text |  |
| encryption\_applied | int |  |
| markup\_language | int |  |
| is\_shared | int |  |
| share\_id | text |  |
| conflict\_original\_id | text |  |
| master\_key\_id | text |  |
| user\_data | text |  |
| deleted\_time | int |  |
| body\_html | text | Note body, in HTML format |
| base\_url | text | If `body_html` is provided and contains relative URLs, provide the `base_url` parameter too so that all the URLs can be converted to absolute ones. The base URL is basically where the HTML was fetched from, minus the query (everything after the '?'). For example if the original page was `https://stackoverflow.com/search?q=%5Bjava%5D+test`, the base URL is `https://stackoverflow.com/search`. |
| image\_data\_url | text | An image to attach to the note, in [Data URL](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/Data_URIs) format. |
| crop\_rect | text | If an image is provided, you can also specify an optional rectangle that will be used to crop the image. In format `{ x: x, y: y, width: width, height: height }` |

### GET /notes

Gets all notes

By default, this call will return the all notes **except** the notes in the trash folder and any conflict note. To include these too, you can specify `include_deleted=1` and `include_conflicts=1` as query parameters.

### GET /notes/:id

Gets note with ID:id

### GET /notes/:id/tags

Gets all the tags attached to this note.

### GET /notes/:id/resources

Gets all the resources attached to this note.

### POST /notes

Creates a new note

You can either specify the note body as Markdown by setting the `body` parameter, or in HTML by setting the `body_html`.

Examples:

- Create a note from some Markdown text
```shell
curl --data '{ "title": "My note", "body": "Some note in **Markdown**"}' http://127.0.0.1:41184/notes
```
- Create a note from some HTML
```shell
curl --data '{ "title": "My note", "body_html": "Some note in <b>HTML</b>"}' http://127.0.0.1:41184/notes
```
- Create a note and attach an image to it:
```shell
curl --data '{ "title": "Image test", "body": "Here is Joplin icon:", "image_data_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAANZJREFUeNoAyAA3/wFwtO3K6gUB/vz2+Prw9fj/+/r+/wBZKAAExOgF4/MC9ff+MRH6Ui4E+/0Bqc/zutj6AgT+/Pz7+vv7++nu82c4DlMqCvLs8goA/gL8/fz09fb59vXa6vzZ6vjT5fbn6voD/fwC8vX4UiT9Zi//APHyAP8ACgUBAPv5APz7BPj2+DIaC2o3E+3o6ywaC5fT6gD6/QD9/QEVf9kD+/dcLQgJA/7v8vqfwOf18wA1IAIEVycAyt//v9XvAPv7APz8LhoIAPz9Ri4OAgwARgx4W/6fVeEAAAAASUVORK5CYII="}' http://127.0.0.1:41184/notes
```

#### Creating a note with a specific ID

When a new note is created, it is automatically assigned a new unique ID so **normally you do not need to set the ID**. However, if for some reason you want to set it, you can supply it as the `id` property. It needs to be a **32 characters long string** in hexadecimal. **Make sure it is unique**, for example by generating it using whatever GUID function is available in your programming language.

```shell
curl --data '{ "id": "00a87474082744c1a8515da6aa5792d2", "title": "My note with custom ID"}' http://127.0.0.1:41184/notes
```

### PUT /notes/:id

Sets the properties of the note with ID:id

### DELETE /notes/:id

Deletes the note with ID:id

By default, the note will be moved **to the trash**. To permanently delete it, add the query parameter `permanent=1`

## Folders

This is actually a notebook. Internally notebooks are called "folders".

### Properties

| Name | Type | Description |
| --- | --- | --- |
| id | text |  |
| title | text | The folder title. |
| created\_time | int | When the folder was created. |
| updated\_time | int | When the folder was last updated. |
| user\_created\_time | int | When the folder was created. It may differ from created\_time as it can be manually set by the user. |
| user\_updated\_time | int | When the folder was last updated. It may differ from updated\_time as it can be manually set by the user. |
| encryption\_cipher\_text | text |  |
| encryption\_applied | int |  |
| parent\_id | text |  |
| is\_shared | int |  |
| share\_id | text |  |
| master\_key\_id | text |  |
| icon | text |  |
| user\_data | text |  |
| deleted\_time | int |  |

### GET /folders

Gets all folders

The folders are returned as a tree. The sub-notebooks of a notebook, if any, are under the `children` key.

### GET /folders/:id

Gets folder with ID:id

### GET /folders/:id/notes

Gets all the notes inside this folder.

### POST /folders

Creates a new folder

### PUT /folders/:id

Sets the properties of the folder with ID:id

### DELETE /folders/:id

Deletes the folder with ID:id

By default, the folder will be moved **to the trash**. To permanently delete it, add the query parameter `permanent=1`

## Resources

### Properties

| Name | Type | Description |
| --- | --- | --- |
| id | text |  |
| title | text | The resource title. |
| mime | text |  |
| filename | text |  |
| created\_time | int | When the resource was created. |
| updated\_time | int | When the resource was last updated. |
| user\_created\_time | int | When the resource was created. It may differ from created\_time as it can be manually set by the user. |
| user\_updated\_time | int | When the resource was last updated. It may differ from updated\_time as it can be manually set by the user. |
| file\_extension | text |  |
| encryption\_cipher\_text | text |  |
| encryption\_applied | int |  |
| encryption\_blob\_encrypted | int |  |
| size | int |  |
| is\_shared | int |  |
| share\_id | text |  |
| master\_key\_id | text |  |
| user\_data | text |  |
| blob\_updated\_time | int |  |
| ocr\_text | text |  |
| ocr\_details | text |  |
| ocr\_status | int |  |
| ocr\_error | text |  |
| ocr\_driver\_id | int |  |

### GET /resources

Gets all resources

### GET /resources/:id

Gets resource with ID:id

### GET /resources/:id/file

Gets the actual file associated with this resource.

### GET /resources/:id/notes

Gets the notes (IDs) associated with a resource.

### POST /resources

Creates a new resource

Creating a new resource is special because you also need to upload the file. Unlike other API calls, this one must have the "multipart/form-data" Content-Type. The file data must be passed to the "data" form field, and the other properties to the "props" form field. An example of a valid call with cURL would be:

```shell
curl -F 'data=@/path/to/file.jpg' -F 'props={"title":"my resource title"}' http://localhost:41184/resources
```

To **update** the resource content, you can make a PUT request with the same arguments:

```shell
curl -X PUT -F 'data=@/path/to/file.jpg' -F 'props={"title":"my modified title"}' http://localhost:41184/resources/8fe1417d7b184324bf6b0122b76c4696
```

The "data" field is required, while the "props" one is not. If not specified, default values will be used.

Or if you only need to update the resource properties (title, etc.), without changing the content, you can make a regular PUT request:

```shell
curl -X PUT --data '{"title": "My new title"}' http://localhost:41184/resources/8fe1417d7b184324bf6b0122b76c4696
```

**From a plugin** the syntax to create a resource is also a bit special:

```javascript
await joplin.data.post(
        ["resources"],
        null,
        { title: "test.jpg" }, // Resource metadata
        [
            {
                path: "/path/to/test.jpg", // Actual file
            },
        ]
    );
```

### PUT /resources/:id

Sets the properties of the resource with ID:id

You may also update the file data by specifying a file (See `POST /resources` example).

### DELETE /resources/:id

Deletes the resource with ID:id

### Properties

| Name | Type | Description |
| --- | --- | --- |
| id | text |  |
| title | text | The tag title. |
| created\_time | int | When the tag was created. |
| updated\_time | int | When the tag was last updated. |
| user\_created\_time | int | When the tag was created. It may differ from created\_time as it can be manually set by the user. |
| user\_updated\_time | int | When the tag was last updated. It may differ from updated\_time as it can be manually set by the user. |
| encryption\_cipher\_text | text |  |
| encryption\_applied | int |  |
| is\_shared | int |  |
| parent\_id | text |  |
| user\_data | text |  |

### GET /tags

Gets all tags

### GET /tags/:id

Gets tag with ID:id

### GET /tags/:id/notes

Gets all the notes with this tag.

Creates a new tag

Post a note to this endpoint to add the tag to the note. The note data must at least contain an ID property (all other properties will be ignored).

### PUT /tags/:id

Sets the properties of the tag with ID:id

### DELETE /tags/:id

Deletes the tag with ID:id

### DELETE /tags/:id/notes/:note\_id

Remove the tag from the note.

## Revisions

### Properties

| Name | Type | Description |
| --- | --- | --- |
| id | text |  |
| parent\_id | text |  |
| item\_type | int |  |
| item\_id | text |  |
| item\_updated\_time | int |  |
| title\_diff | text |  |
| body\_diff | text |  |
| metadata\_diff | text |  |
| encryption\_cipher\_text | text |  |
| encryption\_applied | int |  |
| updated\_time | int |  |
| created\_time | int |  |

### GET /revisions

Gets all revisions

### GET /revisions/:id

Gets revision with ID:id

### POST /revisions

Creates a new revision

### PUT /revisions/:id

Sets the properties of the revision with ID:id

### DELETE /revisions/:id

Deletes the revision with ID:id

## Events

This end point can be used to retrieve the latest note changes. Currently only note changes are tracked.

### Properties

| Name | Type | Description |
| --- | --- | --- |
| id | int |  |
| item\_type | int | The item type (see table above for the list of item types) |
| item\_id | text | The item ID |
| type | int | The type of change - either 1 (created), 2 (updated) or 3 (deleted) |
| created\_time | int | When the event was generated |
| source | int | Unused |
| before\_change\_item | text | Unused |

### GET /events

Returns a paginated list of recent events. A `cursor` property should be provided, which tells from what point in time the events should be returned. The API will return a `cursor` property, to tell from where to resume retrieving events, as well as an `has_more` (tells if more changes can be retrieved) and `items` property, which will contain the list of events. Events are kept for up to 90 days.

If no `cursor` property is provided, the API will respond with the latest change ID. That can be used to retrieve future events later on.

The results are paginated so you may need multiple calls to retrieve all the events. Use the `has_more` property to know if more can be retrieved.

### GET /events/:id

Returns the event with the given ID.