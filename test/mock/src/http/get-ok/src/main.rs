#[macro_use]
extern crate json;
use json::{stringify};
use lambda_http::{run, service_fn, Body, Error, Request, Response};

#[tokio::main]
async fn main() -> Result<(), Error> {
  tracing_subscriber::fmt()
    .with_max_level(tracing::Level::INFO)
    .with_target(false)
    .without_time()
    .init();
  run(service_fn(function_handler)).await
}

async fn function_handler(_event: Request) -> Result<Response<Body>, Error> {
  let body = object!{
    ok: true,
  };
  let resp = Response::builder()
    .status(200)
    .header("content-type", "application/json")
    .body(stringify(body).into())
    .map_err(Box::new)?;
  Ok(resp)
}
