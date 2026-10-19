#include <ApplicationServices/ApplicationServices.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

// Only Fn transitions, Shift up/down, Escape and the microphone key leave
// this process. No typed text is collected.
static CFMachPortRef tap;
static bool fnDown = false;
static bool shiftDown = false; // fn+Shift rewrites the selection instead of dictating
static bool claimMic = false; // --mic: the microphone key (F5 on newer MacBooks) opens the Control Pad
static pid_t parent;
static const int64_t MIC_KEY = 176;
static int64_t mouseButton = -1; // --mouse N: hold this mouse button to dictate (2 middle, 3 back, 4 forward)
static bool mouseDown = false;

static void emit(const char *event) {
  printf("{\"event\":\"%s\"}\n", event);
  fflush(stdout);
}

static CGEventRef handle(CGEventTapProxy proxy, CGEventType type, CGEventRef event, void *info) {
  if (type == kCGEventTapDisabledByTimeout || type == kCGEventTapDisabledByUserInput) {
    fnDown = false;
    emit("reset");
    CGEventTapEnable(tap, true);
    return event;
  }
  if (type == kCGEventKeyDown && CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode) == 53) {
    emit("cancel");
  }
  if (mouseButton >= 0 && (type == kCGEventOtherMouseDown || type == kCGEventOtherMouseUp)
      && CGEventGetIntegerValueField(event, kCGMouseEventButtonNumber) == mouseButton) {
    bool down = type == kCGEventOtherMouseDown;
    if (down != mouseDown) { mouseDown = down; emit(down ? "mouse-down" : "mouse-up"); }
    return NULL; // the browser does not go Back while it dictates
  }
  if (claimMic && (type == kCGEventKeyDown || type == kCGEventKeyUp)
      && CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode) == MIC_KEY) {
    if (type == kCGEventKeyDown && !CGEventGetIntegerValueField(event, kCGKeyboardEventAutorepeat)) emit("mic");
    if (type == kCGEventKeyUp) emit("mic-up"); // held past a moment: the pad shows its cheat sheet
    return NULL; // macOS dictation stays closed while SpeakEasy owns the key
  }
  if (type == kCGEventFlagsChanged) {
    bool shift = (CGEventGetFlags(event) & kCGEventFlagMaskShift) != 0;
    if (shift != shiftDown) { shiftDown = shift; emit(shift ? "shift-down" : "shift-up"); }
  }
  if (type == kCGEventFlagsChanged && CGEventGetIntegerValueField(event, kCGKeyboardEventKeycode) == 63) {
    bool down = (CGEventGetFlags(event) & kCGEventFlagMaskSecondaryFn) != 0;
    if (down != fnDown) { fnDown = down; emit(down ? "down" : "up"); }
    // Claim the standalone dictation key so macOS does not open its Globe menu.
    return NULL;
  }
  return event;
}

static void checkParent(CFRunLoopTimerRef timer, void *info) {
  if (getppid() != parent) { CFRunLoopStop(CFRunLoopGetCurrent()); return; }
  if (!CGEventTapIsEnabled(tap)) {
    fnDown = false;
    emit("reset");
    CGEventTapEnable(tap, true);
    if (!CGEventTapIsEnabled(tap)) {
      emit("permission-required");
      CFRunLoopStop(CFRunLoopGetCurrent());
      return;
    }
  }
  emit("heartbeat");
}

int main(int argc, char **argv) {
  if (argc > 1 && strcmp(argv[1], "--check") == 0) {
    puts("{\"available\":true}");
    return 0;
  }
  parent = getppid();
  for (int i = 1; i < argc; i++) {
    if (strcmp(argv[i], "--mic") == 0) claimMic = true;
    else if (strcmp(argv[i], "--mouse") == 0 && i + 1 < argc) mouseButton = atoi(argv[++i]);
  }
  CGEventMask mask = CGEventMaskBit(kCGEventFlagsChanged) | CGEventMaskBit(kCGEventKeyDown) | CGEventMaskBit(kCGEventKeyUp);
  if (mouseButton >= 0) mask |= CGEventMaskBit(kCGEventOtherMouseDown) | CGEventMaskBit(kCGEventOtherMouseUp);
  tap = CGEventTapCreate(kCGSessionEventTap, kCGHeadInsertEventTap, kCGEventTapOptionDefault, mask, handle, NULL);
  if (!tap) { emit("permission-required"); return 1; }
  CFRunLoopSourceRef source = CFMachPortCreateRunLoopSource(NULL, tap, 0);
  CFRunLoopAddSource(CFRunLoopGetCurrent(), source, kCFRunLoopCommonModes);
  CFRunLoopTimerRef timer = CFRunLoopTimerCreate(NULL, CFAbsoluteTimeGetCurrent() + 2, 2, 0, 0, checkParent, NULL);
  CFRunLoopAddTimer(CFRunLoopGetCurrent(), timer, kCFRunLoopCommonModes);
  CGEventTapEnable(tap, true);
  emit("ready");
  CFRunLoopRun();
  CFRelease(timer);
  CFRelease(source);
  CFRelease(tap);
  return 0;
}
