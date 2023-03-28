const path = require("path");
const fs = require("fs-extra");
const { Observable } = require("rxjs");
const { richTextFromMarkdown } = require('@contentful/rich-text-from-markdown');

const {
  MOCK_OBSERVER,
  CONTENTFUL_LOCALE,
  POST_DIR_TRANSFORMED,
  POST_DIR_CREATED,
  USER_DIR_TRANSFORMED,
  CONTENTFUL_FALLBACK_USER_ID,
  ASSET_DIR_LIST,
  findByGlob
} = require("../util");

// Do not exceed ten, delay is an important factor too
// 8 processes and 1s delay seem to make sense, for 10p/s
const PROCESSES = 8;
// add delays to try and avoid API request limits in
// the parallel processes
const API_DELAY_DUR = 1000;
const UPLOAD_TIMEOUT = 60000;

const CONTENT_TYPE = "blogPost";
const DONE_FILE_PATH = path.join(ASSET_DIR_LIST, "done.json");
const AUTHOR_FILE_PATH = path.join(USER_DIR_TRANSFORMED, "authors.json");
const RESULTS_PATH = path.join(POST_DIR_CREATED, "posts.json");

const delay = (dur = API_DELAY_DUR) =>
  new Promise(resolve => setTimeout(resolve, dur));

const createBlogPosts = (posts, assets, authors, client, observer) => {
  const [inlineMap, heroMap] = createMapsFromAssets(assets);
  const authorMap = createMapFromAuthors(authors);

  return new Promise(complete => {
    const queue = [].concat(posts);
    const processing = new Set();
    const done = [];
    const failed = [];

    observer.next(`Preparing to create ${queue.length} posts`);

    const logProgress = () => {
      observer.next(
        `Remaining: ${queue.length} (${processing.size} uploading, ${
          done.length
        } done, ${failed.length} failed)`
      );
    };

    const createBlogPost = post => {
      const identifier = post.slug;
      processing.add(identifier);
      logProgress();

      return (
        Promise.race([
          new Promise((_, reject) => setTimeout(reject, UPLOAD_TIMEOUT)),
          new Promise(async (resolve, reject) => {
            await delay();

            const exists = await client.getEntries({
              content_type: CONTENT_TYPE,
              "fields.slug[in]": post.slug
            });
            if (exists && exists.total > 0) {
              return reject({ error: "Post already exists", post: exists });
            }

            await delay();

            const tt =  await transform(post, inlineMap, heroMap, authorMap)

            console.log('tt', tt)

            const t1 = tt.fields.body["en-US"].content

            const url1 = "https://raizinvest.com.au/gettheapp"
            const url2 =  "https://3yef.adj.st/home?adj_t=4emcfc6_1okyyjf&adj_deep_link=raiz%3A%2F%2Fhome&adj_fallback=https%3A%2F%2Fapp.raizinvest.com.au%2F"

            const checkIsIncorrectBlock = c => c.content[0].nodeType === 'hyperlink' && c.content[0].content[0].nodeType === 'embedded-asset-block' && (c.content[0].data.uri === url1 || c.content[0].data.uri === url2)

            const blockToReplace = {
              "data": {
                  "target": {
                      "sys": {
                          "id": "1np7UUpbCCtQYZkZXVbCLl",
                          "type": "Link",
                          "linkType": "Entry"
                      }
                  }
              },
              "content": [],
              "nodeType": "embedded-entry-block"
          }

            // const t2 = tt.fields.body["en-US"].content.filter(c => c.nodeType === 'paragraph').map(c =>{
            //   if (checkIsIncorrectBlock(c)) {
            //     return blockToReplace
            //   }

            //   return c
            //   })

              const t3 = tt.fields.body["en-US"].content.reduce((acc,curr) => {

                if (curr.nodeType === 'paragraph' && checkIsIncorrectBlock(curr)) {
                  return [...acc, blockToReplace]
                } else {
                  return [...acc, curr]
                }


              }, [])

              // ).map(c =>{
              //   if (checkIsIncorrectBlock(c)) {
              //     return blockToReplace
              //   }
  
              //   return c
              //   })

            const tx = t3

            tt.fields.body["en-US"].content = tx


            const created = await client.createEntry(
              CONTENT_TYPE,
              tt
            );

            await delay();
            const published = await created.publish();
            await delay();
            resolve(published);

            console.log('\n\n\nTEST', )

          })
        ])

          // happy path
          .then(published => {
            done.push(post);
          })
          // badness
          .catch(error => {
            // TODO: retry failed
            failed.push({ post, error });
          })
          // either
          .finally(() => {
            processing.delete(identifier);
            logProgress();
            // more in queue case
            if (queue.length) createBlogPost(queue.shift());
            // no more in queue, but at lesat one parallel
            // process is in progress
            else if (processing.size) return;
            else complete({ done, failed });
          })
      );
    };
    // safely handle cases where there are less total
    // items than the amount of parallel processes
    let count = 0;
    while (queue.length && count < PROCESSES) {
      createBlogPost(queue.shift());
      count += 1;
    }
  });
};

// HERE
async function transform(post, inlineMap, heroMap, authorMap) {


const document = await richTextFromMarkdown('# Hello World');

const marek = replaceInlineImageUrls(post.body, inlineMap)
const body = await richTextFromMarkdown(marek, (node) => {

  const aaa = node.url.split('/')[4]

  console.log('aaa', aaa)

 
 const ttt=  {
    "data": {
      "target": {
        "sys": {
          "id": "67890",
          "type": "Link",
          "linkType": "Asset"
        }
      }
    },
    "content": [],
    "nodeType": "embedded-asset-block"
  }

  return {

  // nodeType: 'embedded-[entry|asset]-[block|inline]',
  // embedded-entry-block
  // nodeType: 'embedded-asset-block',
  nodeType: 'embedded-asset-block',
  content: [],
  data: {
    target: {
      sys: {
        type: "Link",
        linkType: "Asset",
        id: aaa
      }
    },
  }

  }})
const description = await richTextFromMarkdown(replaceInlineImageUrls(post.description, inlineMap))

const postImageId =  heroMap.get(post.featured_media || post.bodyImages[0]) || inlineMap.get(post.featured_media || post.bodyImages[0]?.link) 

            // '//images.ctfassets.net/uh890olxrk00/6ag9maB6OBm8XAOIjKJB6s/79f3ec6e911482a187b3a7c98940d8e6/christmas.jpg'
const ttt = postImageId.split('/')[4]

  return {
    fields: {
      title: {
        [CONTENTFUL_LOCALE]: post.title
      },
      body: {
        [CONTENTFUL_LOCALE]: body
      },
      excerpt: {
        [CONTENTFUL_LOCALE]: replaceInlineImageUrls(post.description, inlineMap)
      },
      slug: {
        [CONTENTFUL_LOCALE]: post.slug
      },
      date: {
        [CONTENTFUL_LOCALE]: post.publishDate
      },
      postImage: {
        [CONTENTFUL_LOCALE]: {
          sys: {
            type: "Link",
            linkType: "Asset",
            id: ttt
          }
        }
      },
      // author: {
      //   [CONTENTFUL_LOCALE]: {
      //     sys: {
      //       type: "Link",
      //       linkType: "Entry",
      //       id: authorMap.has(post.author)
      //         ? authorMap.get(post.author)
      //         : CONTENTFUL_FALLBACK_USER_ID
      //     }
      //   }
      // }
    }
  };
}

function replaceInlineImageUrls(text, map) {
  let replacedText = text;
  map.forEach((newUrl, oldUrl) => {
    replacedText = replacedText.replace(oldUrl, newUrl);
  });
  return replacedText;
}

function createMapsFromAssets(assets) {
  const links = new Map();
  const heros = new Map();
  assets.forEach(asset =>
    links.set(asset.wordpress.link, asset.contentful.url)
  );
  assets.forEach(
    asset =>
      asset.wordpress.mediaNumber &&
      heros.set(asset.wordpress.mediaNumber, asset.contentful.id)
  );
  return [links, heros];
}

function createMapFromAuthors(authors) {
  const map = new Map();
  authors.forEach(author => {
    if (author.contentful) map.set(author.wordpress.id, author.contentful.id);
  });
  return map;
}

async function processBlogPosts(client, observer = MOCK_OBSERVER) {
  const files = await findByGlob("*.json", { cwd: POST_DIR_TRANSFORMED });


  // TODO: operate on single post for now.
  const queue = [...files].sort();

  const posts = [];
  while (queue.length) {
    const file = queue.shift();
    const post = await fs.readJson(path.join(POST_DIR_TRANSFORMED, file));

    // delete post.description;
    delete post.yoast_head;
    delete post.yoast_head_json;
    posts.push(post);
  }

  const assets = await fs.readJson(DONE_FILE_PATH);
  const authors = await fs.readJson(AUTHOR_FILE_PATH);

  const result = await createBlogPosts(
    posts,
    assets,
    authors,
    client,
    observer
  );

  await fs.ensureDir(POST_DIR_CREATED);
  await fs.writeJson(RESULTS_PATH, result, { spaces: 2 });
  return result;
}

module.exports = client =>
  new Observable(observer =>
    processBlogPosts(client, observer).then(() => observer.complete())
  );

// debug
// (async () => {
//   const client = await require("./create-client")();
//   processBlogPosts(client).then(console.log);
// })();
