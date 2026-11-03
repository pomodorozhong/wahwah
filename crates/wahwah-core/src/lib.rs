//! Generated voices for wahwah: phoneme scripts become a timed score, and the
//! score becomes audio. Nothing here depends on a browser.

mod bank;
mod brass;
mod formant;
mod score;
mod trombone;

pub use brass::render_formant;
pub use score::{Event, Score, ScoreOptions, Segment, Sound, Target, compile_score};
pub use trombone::{TromboneOptions, render_trombone};
