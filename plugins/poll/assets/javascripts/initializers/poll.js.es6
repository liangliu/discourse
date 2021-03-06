import PollController from "discourse/plugins/poll/controllers/poll";
import PostView from "discourse/views/post";

var Poll = Discourse.Model.extend({
  post: null,
  options: [],
  closed: false,

  postObserver: function() {
    this.updateFromJson(this.get('post.poll_details'));
  }.observes('post.poll_details'),

  fetchNewPostDetails: Discourse.debounce(function() {
    var self = this;
    Discourse.debounce(function() {
      self.get('post.topic.postStream').triggerChangedPost(self.get('post.id'), self.get('post.topic.updated_at'));
    }, 500);
  }).observes('post.topic.title'),

  updateFromJson: function(json) {
    var selectedOption = json["selected"];

    var options = [];
    Object.keys(json["options"]).forEach(function(option) {
      options.push(Ember.Object.create({
        option: option,
        votes: json["options"][option],
        checked: (option === selectedOption)
      }));
    });

    this.set('options', options);
    this.set('closed', json.closed);
  },

  saveVote: function(option) {
    this.get('options').forEach(function(opt) {
      opt.set('checked', opt.get('option') === option);
    });

    return Discourse.ajax("/poll", {
      type: "PUT",
      data: {post_id: this.get('post.id'), option: option}
    }).then(function(newJSON) {
      this.updateFromJson(newJSON);
    }.bind(this));
  }
});

var PollView = Ember.View.extend({
  templateName: "poll",
  classNames: ['poll-ui'],
});

function initializePollView(self) {
  var post = self.get('post');
  var pollDetails = post.get('poll_details');

  var poll = Poll.create({post: post});
  poll.updateFromJson(pollDetails);

  var pollController = PollController.create({
    poll: poll,
    showResults: pollDetails["selected"],
    postController: self.get('controller')
  });

  return self.createChildView(PollView, { controller: pollController });
}

export default {
  name: 'poll',

  initialize: function() {
    PostView.reopen({
      createPollUI: function($post) {
        var post = this.get('post');

        if (!post.get('poll_details')) {
          return;
        }

        var view = initializePollView(this);
        var pollContainer = $post.find(".poll-ui:first");
        if (pollContainer.length === 0) {
          pollContainer = $post.find("ul:first");
        }

        var $div = $('<div>');
        pollContainer.replaceWith($div);
        view.constructor.renderer.appendTo(view, $div[0]);
        this.set('pollView', view);

      }.on('postViewInserted'),

      clearPollView: function() {
        if (this.get('pollView')) {
          this.get('pollView').destroy();
        }
      }.on('willClearRender')
    });
  }
};
