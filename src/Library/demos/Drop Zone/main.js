import Gtk from "gi://Gtk";
import Gio from "gi://Gio";
import Adw from "gi://Adw";

import Gdk from "gi://Gdk";
import GObject from "gi://GObject";
import Soup from "gi://Soup";
const bin = workbench.builder.get_object("bin");

const builder = Gdk.ContentFormatsBuilder.new();
builder.add_mime_type("text/uri-list");
const formats = builder.to_formats();

const uri_drop_target = new Gtk.DropTargetAsync({
  actions: Gdk.DragAction.COPY,
  formats: formats,
});

bin.add_controller(uri_drop_target);

uri_drop_target.connect("drop", (self, drop) => {
  drop.read_async(
    ["text/uri-list"],
    Gio.PRIORITY_DEFAULT,
    null,
    (drop, res) => {
      const uris = drop.read_value_finish(res).deep_unpack();
      const firstUri = uris[0];
      if (firstUri.startsWith("file://")) {
        const file = Gio.File.new_for_uri(firstUri);
        bin.child = onDrop(file);
      } else if (
        firstUri.startsWith("http://") ||
        firstUri.startsWith("https://")
      ) {
        bin.child = createImagePreviewFromUrl(firstUri);
      }
      bin.remove_css_class("overlay-drag-area");
    },
  );
  return Gdk.DragAction.COPY;
});

function onDrop(value) {
  if (!(value instanceof Gio.File)) return false;

  const file_info = value.query_info("standard::content-type", 0, null);
  const content_type = file_info.get_content_type();

  if (content_type.startsWith("image/")) {
    return createImagePreview(value);
  } else if (content_type.startsWith("video/")) {
    return createVideoPreview(value);
  } else {
    return createFilePreview(value);
  }
}

function createImagePreviewFromUrl(url) {
  const widget = createBoxWidget();
  const session = new Soup.Session();
  const message = Soup.Message.new("GET", url);

  session.queue_message(message, (session, message) => {
    if (message.status_code !== 200) {
      logError(
        new Error(`Unable to download image from URL: ${url}`),
        "Image download error",
      );
      return;
    }

    const file = Gio.File.new_tmp("imageXXXXXX")[0];
    Gio.file_set_contents(
      file.get_path(),
      message.response_body.flatten().get_as_bytes(),
    );

    const picture = Gtk.Picture.new_for_file(file);
    picture.can_shrink = true;
    picture.content_fit = Gtk.ContentFit.SCALE_DOWN;
    widget.append(picture);
  });

  return widget;
}

function createImagePreview(value) {
  const widget = createBoxWidget();

  const picture = Gtk.Picture.new_for_file(value);
  picture.can_shrink = true;
  picture.content_fit = Gtk.ContentFit.SCALE_DOWN;
  widget.append(picture);
  return widget;
}

function createTextPreview(text) {
  const widget = createBoxWidget();

  const label = new Gtk.Label({ label: text, wrap: true });
  widget.append(label);
  return widget;
}

function createVideoPreview(file) {
  const widget = createBoxWidget();
  const video = new Gtk.Video({ file: file });
  widget.append(video);
  return widget;
}

function createFilePreview(file) {
  const widget = createBoxWidget();

  const file_info = file.query_info("standard::icon", 0, null);
  const icon = Gtk.Image.new_from_gicon(file_info.get_icon());
  widget.append(icon);
  icon.icon_size = Gtk.IconSize.LARGE;

  const file_name = new Gtk.Label({ label: file.get_basename() });
  widget.append(file_name);

  return widget;
}

function createBoxWidget() {
  return new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    halign: Gtk.Align.CENTER,
    valign: Gtk.Align.CENTER,
    spacing: 6,
    margin_top: 12,
    margin_bottom: 12,
    margin_start: 12,
    margin_end: 12,
  });
}
