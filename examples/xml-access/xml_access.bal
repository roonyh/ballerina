import ballerina/io;

public function main() {
    // The XML element with nested children.
    xml bookXML = xml `<book>
                <name>Sherlock Holmes</name>
                <author>
                    <fname title="Sir">Arthur</fname>
                    <mname>Conan</mname>
                    <lname>Doyle</lname>
                </author>
                <!--Price: $10-->
                </book>`;
    
    // You can access child XML items using the field-based or index-based syntax.
    io:println(bookXML.author.fname);
    io:println(bookXML["author"]["fname"]);

    // Accessing a non existing child will return `nil`.
    io:println(bookXML.ISBN.code);
    io:println(bookXML["ISBN"]["code"]);

    // Result of the above field-based or index-based access is another XML. 
    // Any XML function can be invoked on top of the resulting XML.
    io:println(bookXML.author.fname.getTextValue());
    io:println(bookXML["author"]["fname"].getTextValue());

    // You can also retrieve attributes of the resulting child XML.
    io:println(bookXML.author.fname@["title"]);
    io:println(bookXML["author"]["fname"]@["title"]);
}
