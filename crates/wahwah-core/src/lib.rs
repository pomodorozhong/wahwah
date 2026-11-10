//! Generated voices for wahwah: text becomes Mumble, phoneme scripts become a
//! timed score, and one score supplies audio and mouth controls. Nothing here
//! depends on a browser.

mod bank;
mod brass;
pub mod character;
mod formant;
pub mod instruments;
pub mod mouth;
pub mod mumble;
mod performance;
mod score;
mod trombone;

pub use brass::render_formant;
pub use performance::{Performance, Timeline, Voice, render_performance};
pub use score::{Event, Score, ScoreOptions, Segment, Sound, Target, compile_score};
pub use trombone::{TromboneOptions, render_trombone};
