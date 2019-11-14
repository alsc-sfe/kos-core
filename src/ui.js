'use strict';

const Inquirer = require('inquirer');
const Ora = require('ora');


exports.prompt = function(questions) {
  return Inquirer.prompt(questions);
};

exports.confirm = function(msg) {
  return this.prompt([{
    'type': 'confirm',
    'name': 'ok',
    'message': msg
  }]).then(answer => answer.ok);
};

exports.list = function(msg, choices, defaultVal) {
  return this.prompt([{
    'type': 'list',
    'name': 'result',
    'message': msg,
    'choices': choices, // -> [{name, value, short}]
    'default': defaultVal
  }]).then(answer => answer.result);
};

exports.checkbox = function(msg, choices, defaultVal) {
  return this.prompt([{
    'type': 'checkbox',
    'name': 'result',
    'message': msg,
    'choices': choices // -> [{name, value, short, checked}]
  }]).then(answer => answer.result);
};

exports.input = function(msg, defaultVal) {
  return this.prompt([{
    'type': 'input',
    'name': 'result',
    'message': msg,
    'default': defaultVal,
  }]).then(answer => answer.result);
};

exports.spinner = function(desc) {
  return Ora(desc).start();
};


