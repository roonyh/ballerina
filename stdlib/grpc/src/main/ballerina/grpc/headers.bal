// Copyright (c) 2018 WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
//
// WSO2 Inc. licenses this file to you under the Apache License,
// Version 2.0 (the "License"); you may not use this file except
// in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.

# Provides actions to read/write header values in gRPC request/response message.
public type Headers object {

    # Check whether the requested header exists.
    #
    # + headerName - The header name.
    # + return - Returns true if header exists, false otherwise.
    public extern function exists(string headerName) returns boolean;

    # Returns the header value with the specified header name. If there are more than one header value for the
    # specified header name, the first value is returned.
    #
    # + headerName - The header name.
    # + return - Returns first header value if exists, nil otherwise.
    public extern function get(string headerName) returns string?;

    # Gets all transport headers with the specified header name.
    #
    # + headerName - The header name.
    # + return - Returns header value array.
    public extern function getAll(string headerName) returns string[];

    # Sets the value of a transport header.
    #
    # + headerName - The header name.
    # + headerValue - The header value.
    public extern function setEntry(string headerName, string headerValue);

    # Adds the specified key/value pair as an HTTP header to the request.
    #
    # + headerName - The header name.
    # + headerValue - The header value.
    public extern function addEntry(string headerName, string headerValue);

    # Removes a transport header from the request.
    #
    # + headerName - The header name.
    public extern function remove(string headerName);

    # Removes all transport headers from the message.
    public extern function removeAll();
};
