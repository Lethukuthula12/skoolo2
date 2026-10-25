@manual @messaging
Feature: Messages between school and home
  Start with local:reset and the fictional accounts in docs/testing/new-laptop.md.
  Prepare each scenario independently using the Given condition.

  @TC_MSG_001 @P0
  Scenario: Conversation round trip
    Given parent A is linked to Learner A
    When the parent starts a thread and an authorised school user replies
    Then the parent sees both messages in order after reopening the conversation

  @TC_MSG_002 @P0
  Scenario: Class recipient scope
    Given two classes have different linked families
    When a school user messages class A
    Then the intended recipients see it and unrelated families and schools cannot

  @TC_MSG_003 @P1
  Scenario: Empty message validation
    Given a message composer is open
    When the user submits a missing subject or whitespace-only required body
    Then no empty message is saved

  @TC_MSG_004 @P1
  Scenario: Send succeeds but refresh fails
    Given a reply is accepted and the subsequent conversation reload fails
    When the action finishes
    Then feedback distinguishes successful sending from refresh failure and does not encourage a duplicate

  @TC_MSG_005 @P1
  Scenario: Read state and thread privacy
    Given parent A receives a message
    When they read it and parent B attempts to open the same private thread
    Then the read state updates for A and B cannot read or reply
